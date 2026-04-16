import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  DoorClosed,
  Image as ImageIcon,
  LayoutGrid,
  ListTodo,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";

type Role = "cleaner" | "admin";
type RoomStatus = "pending" | "in_progress" | "completed";
type BuildingType = "A" | "B";
type AdminView = "overview" | "activity" | "staff" | "calendar";
type ActivityCategory = "法會" | "活動" | "團住" | "單住" | "宴會" | "一般活動";
type OverviewFilter = "all" | RoomStatus;

type User = {
  id: string;
  name: string;
  role: Role;
  pin: string;
  note?: string;
};

type SubItem = {
  id: string;
  label: string;
  done: boolean;
};

type ChecklistItem = {
  id: string;
  label: string;
  description: string;
  requiredPhoto: boolean;
  done: boolean;
  photo: boolean;
  photoName: string;
  subItems: SubItem[];
};

type Room = {
  id: string;
  building: BuildingType;
  floor: number;
  roomNo: string;
  roomName: string;
  assignedTo: string;
  occupant: string;
  status: RoomStatus;
  checklist: ChecklistItem[];
  lastUpdated?: string;
};

type Activity = {
  id: string;
  date: string;
  name: string;
  contact: string;
  category: ActivityCategory;
  requiresCleaning: boolean;
  rooms: Room[];
};

type ActivityModal = {
  open: boolean;
  mode: "add" | "edit";
  id: string;
  date: string;
  name: string;
  contact: string;
  category: ActivityCategory;
  requiresCleaning: boolean;
};

type RoomModal = {
  open: boolean;
  building: BuildingType;
  floor: string;
  roomName: string;
  staffName: string;
  occupant: string;
};

const staffSeed: User[] = [
  { id: "u1", name: "王阿姨", role: "cleaner", pin: "1234", note: "" },
  { id: "u2", name: "李阿姨", role: "cleaner", pin: "2234", note: "" },
  { id: "u3", name: "陳阿姨", role: "cleaner", pin: "3234", note: "" },
  { id: "u4", name: "林經理", role: "admin", pin: "9999" },
];

const activityCategories: ActivityCategory[] = ["法會", "活動", "團住", "單住", "宴會", "一般活動"];

const checklistTemplate = [
  {
    id: "flooring",
    label: "掃地、拖地",
    description: "地板需清潔乾淨，無明顯灰塵、毛髮、污漬。",
    requiredPhoto: true,
    subItems: [
      { id: "sweep", label: "掃地" },
      { id: "mop", label: "拖地" },
    ],
  },
  {
    id: "surface_cleaning",
    label: "擦桌椅櫃子洗手台",
    description: "桌面、椅子、櫃體、洗手台表面需擦拭乾淨。",
    requiredPhoto: false,
    subItems: [
      { id: "table", label: "擦桌子" },
      { id: "chair", label: "擦椅子" },
      { id: "cabinet", label: "擦櫃子" },
      { id: "sink", label: "擦洗手台" },
    ],
  },
  {
    id: "bed_setup",
    label: "整理床鋪",
    description: "鋪設床墊＋床罩、棉被＋被套、枕頭套最後擺設完整。",
    requiredPhoto: false,
    subItems: [
      { id: "mattress", label: "鋪設床墊" },
      { id: "bed_cover", label: "鋪設床罩" },
      { id: "quilt", label: "棉被＋被套" },
      { id: "pillow", label: "枕頭套" },
      { id: "bed_final", label: "最後擺設完整" },
    ],
  },
  {
    id: "bathroom",
    label: "廁所清潔",
    description: "擺放踏墊、沐浴乳／肥皂、衛生紙、吹風機。",
    requiredPhoto: true,
    subItems: [
      { id: "bathroom_clean", label: "廁所清潔完成" },
      { id: "mat", label: "擺放踏墊" },
      { id: "soap", label: "擺放沐浴乳／肥皂" },
      { id: "toilet_paper", label: "擺放衛生紙" },
      { id: "dryer", label: "擺放吹風機" },
    ],
  },
] as const;

function buildChecklist(): ChecklistItem[] {
  return checklistTemplate.map((item) => ({
    ...item,
    done: false,
    photo: false,
    photoName: "",
    subItems: item.subItems.map((sub) => ({ ...sub, done: false })),
  }));
}

function computeRoomStatus(checklist: ChecklistItem[]): RoomStatus {
  const total = checklist.length;
  const completed = checklist.filter((item) => item.done).length;
  if (completed === 0) return "pending";
  if (completed === total) return "completed";
  return "in_progress";
}

function roomProgress(room: Room): number {
  const total = room.checklist.length;
  const done = room.checklist.filter((item) => item.done).length;
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

function roomLabel(room: Pick<Room, "building" | "roomName" | "roomNo">): string {
  return `${room.building}棟 ♔ ${room.roomName || room.roomNo}房`;
}

function formatActivityDate(date: string): string {
  return date ? date.replace(/-/g, "/") : "";
}

function formatFloorLabel(floor: number): string {
  return `${floor}F`;
}

function parseFloorValue(input: string): number | null {
  const cleaned = String(input).trim();
  if (!cleaned) return null;
  if (/^\d+$/.test(cleaned)) return Number(cleaned);
  return null;
}

function createRoom(params: {
  building: BuildingType;
  floor: number;
  sequence: number;
  assignedTo: string;
  roomName?: string;
  occupant?: string;
}): Room {
  const { building, floor, sequence, assignedTo, roomName = "", occupant = "" } = params;
  const roomNo = `${floor}${String(sequence).padStart(2, "0")}`;
  return {
    id: `${building}-${roomNo}-${Math.random().toString(36).slice(2, 8)}`,
    building,
    floor,
    roomNo,
    roomName: roomName || roomNo,
    assignedTo,
    occupant,
    status: "pending",
    checklist: buildChecklist(),
  };
}

function buildInitialRooms(): Room[] {
  const staffNames = ["王阿姨", "李阿姨", "陳阿姨", "未分配"];
  const floors = [2, 3, 4, 5, 6, 7];
  const buildings: BuildingType[] = ["A", "B"];

  const rooms = buildings.flatMap((building, buildingIndex) =>
    floors.flatMap((floor) =>
      Array.from({ length: 8 }, (_, index) => {
        const sequence = index + 1;
        const assignedTo = staffNames[(buildingIndex + floor + sequence) % staffNames.length];
        return createRoom({ building, floor, sequence, assignedTo });
      })
    )
  );

  if (rooms[0]) {
    rooms[0].checklist[0].done = true;
    rooms[0].checklist[0].photo = true;
    rooms[0].checklist[0].subItems = rooms[0].checklist[0].subItems.map((item) => ({ ...item, done: true }));
    rooms[0].status = "in_progress";
  }

  if (rooms[1]) {
    rooms[1].checklist = rooms[1].checklist.map((item) => ({
      ...item,
      done: true,
      photo: item.requiredPhoto,
      subItems: item.subItems.map((sub) => ({ ...sub, done: true })),
    }));
    rooms[1].status = "completed";
  }

  return rooms;
}

function cloneRooms(rooms: Room[]): Room[] {
  return JSON.parse(JSON.stringify(rooms));
}

function sortActivitiesByNearest(list: Activity[]): Activity[] {
  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const distance = (date: string) => {
    const target = new Date(`${date}T00:00:00`);
    return Math.abs(target.getTime() - todayDate.getTime());
  };
  return [...list].sort((a, b) => {
    const diff = distance(a.date) - distance(b.date);
    if (diff !== 0) return diff;
    return String(b.date).localeCompare(String(a.date));
  });
}

function statusChip(status: RoomStatus): string {
  if (status === "completed") return "已完成";
  if (status === "in_progress") return "進行中";
  return "未開始";
}

function statusChipClass(status: RoomStatus): string {
  if (status === "completed") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "in_progress") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-[#F1F5F9] text-[#334155] border-[#CBD5E1]";
}

function nowString(): string {
  return new Date().toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getMonthLabel(date: Date): string {
  return `${date.getFullYear()}年 ${date.getMonth() + 1}月`;
}

function isSameDate(dateA: Date, dateB: Date): boolean {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

function buildCalendarDays(baseDate: Date): Date[] {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay();
  const startDate = new Date(year, month, 1 - firstWeekday);
  return Array.from({ length: 42 }, (_, index) => new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + index));
}

function SectionTitle({ title, sub, icon }: { title: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      {icon ? (
        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-2xl bg-[#EAF1FB] text-[#22426A]">
          {icon}
        </div>
      ) : null}
      <div>
        <div className="text-[15px] font-semibold tracking-tight text-[#0F172A]">{title}</div>
        {sub ? <div className="mt-1 text-[11px] leading-5 text-[#64748B]">{sub}</div> : null}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: RoomStatus }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${statusChipClass(status)}`}>{statusChip(status)}</span>;
}

function InfoPill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-[#F1F5F9] px-2 py-1 text-[11px] font-semibold text-[#475569]">{children}</span>;
}

function RoomMiniProgress({ value }: { value: number }) {
  return (
    <div className="w-full max-w-[96px]">
      <div className="h-2 overflow-hidden rounded-full bg-[#E8EEF5]">
        <div className="h-full rounded-full bg-[#22426A]" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
      <div className="mt-1 text-right text-[10px] text-[#64748B]">{value}%</div>
    </div>
  );
}

export default function HotelHousekeepingMobileWeb() {
  const [staffUsers, setStaffUsers] = useState<User[]>(staffSeed.filter((u) => u.role === "cleaner"));
  const [currentUser, setCurrentUser] = useState<User>(staffSeed[0]);
  const [selectedUserId, setSelectedUserId] = useState(staffSeed[0].id);
  const [pin, setPin] = useState("1234");
  const [showLoginPanel, setShowLoginPanel] = useState(false);
  const [viewMode, setViewMode] = useState<"staff" | "admin">("staff");
  const [roomFilter, setRoomFilter] = useState<"all" | "completed" | "pending">("all");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [photoModal, setPhotoModal] = useState({ open: false, roomId: "", itemId: "" });
  const [adminView, setAdminView] = useState<AdminView>("overview");
  const [selectedActivityId, setSelectedActivityId] = useState("act-1");
  const [selectedStaffName, setSelectedStaffName] = useState("王阿姨");
  const [activityModal, setActivityModal] = useState<ActivityModal>({
    open: false,
    mode: "add",
    id: "",
    date: "",
    name: "",
    contact: "",
    category: "活動",
    requiresCleaning: true,
  });
  const [activityRoomModal, setActivityRoomModal] = useState<RoomModal>({
    open: false,
    building: "A",
    floor: "2",
    roomName: "201",
    staffName: "未分配",
    occupant: "",
  });
  const [staffModal, setStaffModal] = useState({
    open: false,
    mode: "add" as "add" | "edit",
    id: "",
    name: "",
    note: "",
  });
  const [showStaffFilter, setShowStaffFilter] = useState(false);
  const [activitySelectedBuilding, setActivitySelectedBuilding] = useState<"all" | BuildingType>("all");
  const [activitySelectedFloor, setActivitySelectedFloor] = useState("all");
  const [activityStaffFilter, setActivityStaffFilter] = useState("all");
  const [expandedStaffRooms, setExpandedStaffRooms] = useState<string[]>([]);
  const [expandedCleanerRoomId, setExpandedCleanerRoomId] = useState<string>("");
  const [overviewFilter, setOverviewFilter] = useState<OverviewFilter>("all");
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date(2026, 3, 1));
  const [activities, setActivities] = useState<Activity[]>([
    {
      id: "act-1",
      date: "2026-04-20",
      name: "禪修營",
      contact: "王小姐",
      category: "活動",
      requiresCleaning: true,
      rooms: cloneRooms(buildInitialRooms()),
    },
    {
      id: "act-2",
      date: "2026-04-18",
      name: "主管參訪",
      contact: "林經理",
      category: "一般活動",
      requiresCleaning: false,
      rooms: [],
    },
  ]);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const role = currentUser.role;

  const sortedActivities = useMemo(() => sortActivitiesByNearest(activities), [activities]);
  const cleaningActivities = useMemo(() => sortedActivities.filter((activity) => activity.requiresCleaning), [sortedActivities]);
  const selectedActivity = useMemo(
    () => cleaningActivities.find((item) => item.id === selectedActivityId) || cleaningActivities[0] || null,
    [cleaningActivities, selectedActivityId]
  );
  const latestActivity = selectedActivity || cleaningActivities[0] || null;
  const latestActivityRooms = latestActivity?.rooms || [];

  const cleanerRooms = useMemo(() => {
    const baseRooms = role === "admin" ? latestActivityRooms : latestActivityRooms.filter((room) => room.assignedTo === currentUser.name);
    if (roomFilter === "completed") return baseRooms.filter((room) => room.status === "completed");
    if (roomFilter === "pending") return baseRooms.filter((room) => room.status !== "completed");
    return baseRooms;
  }, [latestActivityRooms, role, currentUser.name, roomFilter]);

  useEffect(() => {
    if (!selectedRoomId && cleanerRooms[0]) {
      setSelectedRoomId(cleanerRooms[0].id);
      setExpandedCleanerRoomId(cleanerRooms[0].id);
      return;
    }
    if (selectedRoomId && !cleanerRooms.find((room) => room.id === selectedRoomId) && cleanerRooms[0]) {
      setSelectedRoomId(cleanerRooms[0].id);
      setExpandedCleanerRoomId(cleanerRooms[0].id);
    }
  }, [cleanerRooms, selectedRoomId]);

  const adminSummary = useMemo(() => {
    const total = latestActivityRooms.length;
    const completed = latestActivityRooms.filter((room) => room.status === "completed").length;
    const inProgress = latestActivityRooms.filter((room) => room.status === "in_progress").length;
    const pending = latestActivityRooms.filter((room) => room.status === "pending").length;
    return { total, completed, inProgress, pending };
  }, [latestActivityRooms]);

  const overviewRooms = useMemo(() => {
    if (overviewFilter === "all") return latestActivityRooms;
    return latestActivityRooms.filter((room) => room.status === overviewFilter);
  }, [latestActivityRooms, overviewFilter]);

  const activityRooms = selectedActivity?.rooms || [];

  const activityAvailableFloors = useMemo(() => {
    const source = activityRooms.filter((room) => activitySelectedBuilding === "all" || room.building === activitySelectedBuilding);
    return Array.from(new Set(source.map((room) => room.floor))).sort((a, b) => a - b);
  }, [activityRooms, activitySelectedBuilding]);

  const activityDisplayRooms = useMemo(() => {
    let source = activityRooms.filter((room) => activitySelectedBuilding === "all" || room.building === activitySelectedBuilding);
    source = [...source].sort((a, b) => {
      if (a.building !== b.building) return a.building.localeCompare(b.building, "zh-Hant");
      if (a.floor !== b.floor) return a.floor - b.floor;
      return String(a.roomName || a.roomNo).localeCompare(String(b.roomName || b.roomNo), "zh-Hant");
    });
    if (activitySelectedFloor !== "all") source = source.filter((room) => String(room.floor) === activitySelectedFloor);
    if (activityStaffFilter !== "all") source = source.filter((room) => room.assignedTo === activityStaffFilter);
    return source;
  }, [activityRooms, activitySelectedBuilding, activitySelectedFloor, activityStaffFilter]);

  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);

  const activitiesByDate = useMemo(() => {
    const map = new Map<string, Activity[]>();
    sortedActivities.forEach((activity) => {
      const key = activity.date;
      const existing = map.get(key) || [];
      existing.push(activity);
      map.set(key, existing);
    });
    return map;
  }, [sortedActivities]);

  const handleLogin = () => {
    const allUsers = [...staffUsers, staffSeed.find((u) => u.role === "admin")].filter(Boolean) as User[];
    const found = allUsers.find((user) => user.id === selectedUserId && user.pin === pin);
    if (!found) {
      alert("PIN 碼錯誤，請重新輸入");
      return;
    }
    setCurrentUser(found);
    setShowLoginPanel(false);
    if (found.role === "cleaner") {
      setViewMode("staff");
      setSelectedStaffName(found.name);
    }
  };

  const updateLatestActivityRoomChecklist = (roomId: string, updater: (room: Room) => Room) => {
    if (!latestActivity) return;
    setActivities((prev) =>
      prev.map((activity) => {
        if (activity.id !== latestActivity.id) return activity;
        return {
          ...activity,
          rooms: activity.rooms.map((room) => {
            if (room.id !== roomId) return room;
            const updated = updater(room);
            return {
              ...updated,
              status: computeRoomStatus(updated.checklist),
              lastUpdated: nowString(),
            };
          }),
        };
      })
    );
  };

  const handleMainToggle = (roomId: string, itemId: string, checked: boolean) => {
    const room = latestActivityRooms.find((r) => r.id === roomId);
    const target = room?.checklist.find((item) => item.id === itemId);
    if (!room || !target) return;
    if (checked && target.requiredPhoto && !target.photo) {
      setPhotoModal({ open: true, roomId, itemId });
      return;
    }
    updateLatestActivityRoomChecklist(roomId, (targetRoom) => ({
      ...targetRoom,
      checklist: targetRoom.checklist.map((item) =>
        item.id !== itemId
          ? item
          : {
              ...item,
              done: checked,
              subItems: item.subItems.map((sub) => ({ ...sub, done: checked })),
            }
      ),
    }));
  };

  const handleSubItemToggle = (roomId: string, itemId: string, subItemId: string, checked: boolean) => {
    const room = latestActivityRooms.find((r) => r.id === roomId);
    const target = room?.checklist.find((item) => item.id === itemId);
    if (!room || !target) return;
    const currentIndex = target.subItems.findIndex((sub) => sub.id === subItemId);
    const isLast = currentIndex === target.subItems.length - 1;
    if (checked && target.requiredPhoto && isLast && !target.photo) {
      setPhotoModal({ open: true, roomId, itemId });
      return;
    }
    updateLatestActivityRoomChecklist(roomId, (targetRoom) => ({
      ...targetRoom,
      checklist: targetRoom.checklist.map((item) => {
        if (item.id !== itemId) return item;
        const nextSubItems = item.subItems.map((sub) => (sub.id === subItemId ? { ...sub, done: checked } : sub));
        return {
          ...item,
          subItems: nextSubItems,
          done: nextSubItems.every((sub) => sub.done),
        };
      }),
    }));
  };

  const handlePhotoUpload = (roomId: string, itemId: string, file?: File) => {
    if (!file) return;
    updateLatestActivityRoomChecklist(roomId, (room) => ({
      ...room,
      checklist: room.checklist.map((item) => (item.id === itemId ? { ...item, photo: true, photoName: file.name } : item)),
    }));
    setPhotoModal({ open: false, roomId: "", itemId: "" });
  };

  const triggerUpload = (roomId: string, itemId: string) => {
    const key = `${roomId}-${itemId}`;
    fileInputRefs.current[key]?.click();
  };

  const updateActivityRooms = (updater: (rooms: Room[]) => Room[]) => {
    if (!selectedActivity) return;
    setActivities((prev) =>
      prev.map((activity) => (activity.id === selectedActivity.id ? { ...activity, rooms: updater(activity.rooms) } : activity))
    );
  };

  const openEditActivityModal = (activity: Activity) => {
    setActivityModal({
      open: true,
      mode: "edit",
      id: activity.id,
      date: activity.date,
      name: activity.name,
      contact: activity.contact,
      category: activity.category,
      requiresCleaning: activity.requiresCleaning,
    });
  };

  const handleChangeActivityOccupant = (roomId: string, occupant: string) => {
    updateActivityRooms((prev) => prev.map((room) => (room.id === roomId ? { ...room, occupant } : room)));
  };

  const handleAssignActivityRoomToStaff = (roomId: string, staffName: string) => {
    updateActivityRooms((prev) => prev.map((room) => (room.id === roomId ? { ...room, assignedTo: staffName } : room)));
  };

  const handleDeleteActivityRoom = (roomId: string) => {
    updateActivityRooms((prev) => prev.filter((room) => room.id !== roomId));
  };

  const saveActivity = () => {
    const date = activityModal.date.trim();
    const name = activityModal.name.trim();
    const contact = activityModal.contact.trim();
    if (!date || !name || !contact) return;

    if (activityModal.mode === "add") {
      const newActivity: Activity = {
        id: `act-${Date.now()}`,
        date,
        name,
        contact,
        category: activityModal.category,
        requiresCleaning: activityModal.requiresCleaning,
        rooms: activityModal.requiresCleaning ? cloneRooms(buildInitialRooms()) : [],
      };
      setActivities((prev) => sortActivitiesByNearest([newActivity, ...prev]));
      if (newActivity.requiresCleaning) {
        setSelectedActivityId(newActivity.id);
        setAdminView("activity");
      } else {
        setAdminView("calendar");
      }
      setActivityModal({ open: false, mode: "add", id: "", date: "", name: "", contact: "", category: "活動", requiresCleaning: true });
      return;
    }

    setActivities((prev) =>
      sortActivitiesByNearest(
        prev.map((activity) => {
          if (activity.id !== activityModal.id) return activity;
          const nextRequiresCleaning = activityModal.requiresCleaning;
          return {
            ...activity,
            date,
            name,
            contact,
            category: activityModal.category,
            requiresCleaning: nextRequiresCleaning,
            rooms: nextRequiresCleaning ? (activity.rooms.length > 0 ? activity.rooms : cloneRooms(buildInitialRooms())) : [],
          };
        })
      )
    );
    setActivityModal({ open: false, mode: "add", id: "", date: "", name: "", contact: "", category: "活動", requiresCleaning: true });
  };

  const saveActivityRoom = () => {
    if (!selectedActivity) return;
    const floor = parseFloorValue(activityRoomModal.floor);
    const roomName = activityRoomModal.roomName.trim();
    if (floor === null || !roomName) return;

    const exists = activityRooms.some(
      (room) => room.building === activityRoomModal.building && room.floor === floor && (room.roomName || room.roomNo) === roomName
    );
    if (exists) {
      alert("房號重複，請重新輸入");
      return;
    }

    updateActivityRooms((prev) => {
      const sameFloorRooms = prev.filter((room) => room.building === activityRoomModal.building && room.floor === floor);
      const sequence = sameFloorRooms.length + 1;
      return [
        ...prev,
        createRoom({
          building: activityRoomModal.building,
          floor,
          sequence,
          assignedTo: activityRoomModal.staffName || "未分配",
          roomName,
          occupant: activityRoomModal.occupant,
        }),
      ];
    });

    setActivityRoomModal({
      open: false,
      building: "A",
      floor: "2",
      roomName: "201",
      staffName: staffUsers[0]?.name || "未分配",
      occupant: "",
    });
  };

  const saveStaff = () => {
    const name = staffModal.name.trim();
    if (!name) return;
    if (staffModal.mode === "add") {
      const next = staffUsers.length + 1;
      setStaffUsers((prev) => [
        ...prev,
        {
          id: `u${next + 10}`,
          name,
          role: "cleaner",
          pin: `${next}${next}${next}${next}`,
          note: staffModal.note,
        },
      ]);
    } else {
      setStaffUsers((prev) => prev.map((user) => (user.id === staffModal.id ? { ...user, name, note: staffModal.note } : user)));
    }
    setStaffModal({ open: false, mode: "add", id: "", name: "", note: "" });
  };

  const handleDeleteActivity = () => {
    if (activityModal.mode !== "edit") return;
    const nextActivities = activities.filter((activity) => activity.id !== activityModal.id);
    setActivities(sortActivitiesByNearest(nextActivities));
    if (selectedActivityId === activityModal.id) {
      setSelectedActivityId(nextActivities.find((activity) => activity.requiresCleaning)?.id || "");
    }
    setActivityModal({ open: false, mode: "add", id: "", date: "", name: "", contact: "", category: "活動", requiresCleaning: true });
  };

  const handleDuplicateActivity = () => {
    if (activityModal.mode !== "edit") return;
    const source = activities.find((activity) => activity.id === activityModal.id);
    if (!source) return;
    const copy: Activity = {
      ...source,
      id: `act-${Date.now()}`,
      rooms: cloneRooms(source.rooms),
    };
    setActivities((prev) => sortActivitiesByNearest([copy, ...prev]));
    if (copy.requiresCleaning) {
      setSelectedActivityId(copy.id);
      setAdminView("activity");
    }
    setActivityModal({ open: false, mode: "add", id: "", date: "", name: "", contact: "", category: "活動", requiresCleaning: true });
  };

  const overviewCards = [
    { key: "all" as OverviewFilter, label: "全部", value: adminSummary.total },
    { key: "completed" as OverviewFilter, label: "完成", value: adminSummary.completed },
    { key: "in_progress" as OverviewFilter, label: "進行", value: adminSummary.inProgress },
    { key: "pending" as OverviewFilter, label: "未開始", value: adminSummary.pending },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#ffffff_0%,#f8fafc_45%,#eef4fb_100%)] text-[#0F172A]">
      <div className="mx-auto max-w-md px-3 pb-28 pt-3">
        <div className="overflow-hidden rounded-[28px] border border-[#D9E2EC] bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
          <div className="bg-[linear-gradient(135deg,#0f172a_0%,#1e3a5f_100%)] px-4 py-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                  <ShieldCheck className="h-5 w-5" />
                  飯店房務管理系統
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-white/70">
                  <Sparkles className="h-3.5 w-3.5" />
                  今日介面已優化為手機管理版
                </div>
              </div>
              <button onClick={() => setShowLoginPanel((prev) => !prev)} className="rounded-[20px] border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white backdrop-blur">
                切換帳號
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/80">
                目前登入：{currentUser.name}
              </div>
              {role === "admin" && (
                <button
                  onClick={() => setViewMode((prev) => (prev === "admin" ? "staff" : "admin"))}
                  className="rounded-[20px] border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur"
                >
                  {viewMode === "admin" ? "員工頁" : "後台頁"}
                </button>
              )}
            </div>
          </div>

          {showLoginPanel && (
            <div className="space-y-2 border-t border-[#E8EEF5] bg-[#F8FBFF] p-3">
              <select
                value={selectedUserId}
                onChange={(e) => {
                  setSelectedUserId(e.target.value);
                  const selected = [...staffUsers, staffSeed.find((u) => u.role === "admin")].find((user) => user?.id === e.target.value);
                  if (selected) setPin(selected.pin);
                }}
                className="w-full rounded-[18px] border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm text-[#0F172A]"
              >
                {[...staffUsers, staffSeed.find((u) => u.role === "admin")].map((user) => (
                  <option key={user!.id} value={user!.id}>
                    {user!.name} / {user!.role === "admin" ? "主管" : "員工"}
                  </option>
                ))}
              </select>
              <input value={pin} onChange={(e) => setPin(e.target.value)} className="w-full rounded-[18px] border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm" placeholder="輸入 PIN" />
              <button onClick={handleLogin} className="w-full rounded-[18px] bg-[#0F172A] px-3 py-2.5 text-sm font-medium text-white">
                登入
              </button>
            </div>
          )}
        </div>

        {viewMode === "staff" ? (
          <div className="mt-3 space-y-3">
            <div className="rounded-[28px] border border-[#D9E2EC] bg-white p-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <SectionTitle
                title="我的房間"
                sub={latestActivity ? `${formatActivityDate(latestActivity.date)} ${latestActivity.name}` : undefined}
                icon={<DoorClosed className="h-4 w-4" />}
              />

              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  { key: "all", label: "全部" },
                  { key: "completed", label: "完成" },
                  { key: "pending", label: "未完成" },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setRoomFilter(item.key as typeof roomFilter)}
                    className={`rounded-[18px] px-3 py-2.5 text-sm font-medium transition ${roomFilter === item.key ? "bg-[#0F172A] text-white shadow-sm" : "bg-[#E2E8F0] text-[#334155] hover:bg-[#d9e3ef]"}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="mt-3 space-y-2">
                {cleanerRooms.map((room) => {
                  const expanded = expandedCleanerRoomId === room.id;
                  return (
                    <div key={room.id} className="rounded-[20px] border border-[#D9E2EC] bg-white shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
                      <button
                        onClick={() => {
                          setSelectedRoomId(room.id);
                          setExpandedCleanerRoomId((prev) => (prev === room.id ? "" : room.id));
                        }}
                        className={`flex w-full items-center justify-between gap-3 rounded-[20px] px-3 py-3 text-left transition ${expanded ? "bg-[#0F172A] text-white" : "hover:bg-[#F8FBFF]"}`}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-[15px] font-semibold">{roomLabel(room)}</div>
                          <div className="mt-1 flex items-center gap-2">
                            <StatusBadge status={room.status} />
                            <span className={`text-[11px] ${expanded ? "text-white/75" : "text-[#64748B]"}`}>{room.assignedTo}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <InfoPill>{roomProgress(room)}%</InfoPill>
                          <ChevronDown className={`h-4 w-4 transition ${expanded ? "rotate-180 text-white" : "text-[#64748B]"}`} />
                        </div>
                      </button>

                      {expanded && (
                        <div className="border-t border-[#E8EEF5] bg-[#FBFDFF] px-3 py-3">
                          <div className="space-y-2.5">
                            {room.checklist.map((item, index) => {
                              const fileKey = `${room.id}-${item.id}`;
                              return (
                                <div key={item.id} className="rounded-[18px] border border-[#D9E2EC] bg-white px-3 py-3">
                                  <div className="flex items-start gap-3">
                                    <input type="checkbox" checked={item.done} onChange={(e) => handleMainToggle(room.id, item.id, e.target.checked)} className="mt-1 h-6 w-6 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[#EAF1FB] px-2 text-xs font-semibold text-[#22426A]">{index + 1}</span>
                                            <div className="text-base font-semibold leading-tight">{item.label}</div>
                                          </div>
                                          <div className="mt-1 text-sm leading-snug text-[#64748B]">{item.description}</div>
                                        </div>
                                        {item.requiredPhoto && (
                                          <div className="shrink-0">
                                            <input
                                              ref={(el) => {
                                                fileInputRefs.current[fileKey] = el;
                                              }}
                                              type="file"
                                              accept="image/*"
                                              className="hidden"
                                              onChange={(e) => handlePhotoUpload(room.id, item.id, e.target.files?.[0] || undefined)}
                                            />
                                            <button
                                              onClick={() => triggerUpload(room.id, item.id)}
                                              className={`rounded-[18px] border px-3 py-1.5 text-sm font-medium ${item.photo ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-[#CBD5E1] bg-[#F8FAFC] text-[#334155]"}`}
                                            >
                                              <span className="inline-flex items-center gap-1.5">
                                                <ImageIcon className="h-3.5 w-3.5" />
                                                {item.photo ? "已拍照" : "拍照"}
                                              </span>
                                            </button>
                                          </div>
                                        )}
                                      </div>

                                      <div className="mt-3 space-y-1 rounded-[16px] bg-[#F8FAFC] px-3 py-2.5">
                                        {item.subItems.map((sub) => (
                                          <label key={sub.id} className="flex items-start gap-2 rounded-[14px] px-1 py-1 transition hover:bg-white">
                                            <input type="checkbox" checked={sub.done} onChange={(e) => handleSubItemToggle(room.id, item.id, sub.id, e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />
                                            <span className="text-sm leading-snug text-[#334155]">{sub.label}</span>
                                          </label>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {adminView === "overview" && (
              <div className="rounded-[28px] border border-[#D9E2EC] bg-white p-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                <SectionTitle
                  title="房間最新整理現況"
                  sub={latestActivity ? `${formatActivityDate(latestActivity.date)} ${latestActivity.name}` : "目前無打掃活動"}
                  icon={<LayoutGrid className="h-4 w-4" />}
                />

                <div className="mt-3 grid grid-cols-4 gap-2">
                  {overviewCards.map((card) => (
                    <button
                      key={card.label}
                      onClick={() => setOverviewFilter(card.key)}
                      className={`rounded-[18px] border px-2 py-2 text-center shadow-[0_4px_10px_rgba(15,23,42,0.03)] transition ${overviewFilter === card.key ? "border-[#0F172A] bg-[#0F172A] text-white" : "border-[#D9E2EC] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] text-[#0F172A] hover:-translate-y-[1px]"}`}
                    >
                      <div className={`text-[10px] leading-none ${overviewFilter === card.key ? "text-white/80" : "text-[#64748B]"}`}>{card.label}</div>
                      <div className="mt-1 text-lg font-semibold leading-none">{card.value}</div>
                    </button>
                  ))}
                </div>

                <div className="mt-3 rounded-[20px] border border-[#D9E2EC] bg-[#F8FBFF] p-2">
                  <div className="space-y-2">
                    {overviewRooms.length > 0 ? (
                      overviewRooms.map((room) => (
                        <div key={room.id} className="rounded-[18px] border border-[#D9E2EC] bg-white px-3 py-3 shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
                          <div className="flex items-center gap-2 text-sm font-medium leading-6 text-[#0F172A]">
                            <DoorClosed className="h-4 w-4 shrink-0 text-[#22426A]" />
                            <span className="truncate">{roomLabel(room)}</span>
                          </div>

                          <div className="mt-3 grid grid-cols-[1fr_148px_84px_34px] items-center gap-2">
                            <input
                              value={room.occupant || ""}
                              onChange={(e) => handleChangeActivityOccupant(room.id, e.target.value)}
                              className="h-12 w-full rounded-[16px] border border-[#CBD5E1] bg-[#FBFDFF] px-3 text-sm text-[#334155] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#93C5FD]"
                              placeholder="住宿人"
                            />

                            <select
                              value={room.assignedTo}
                              onChange={(e) => handleAssignActivityRoomToStaff(room.id, e.target.value)}
                              className="h-12 w-full rounded-[16px] border border-[#CBD5E1] bg-[#FBFDFF] px-3 text-sm text-[#334155] focus:outline-none focus:ring-2 focus:ring-[#93C5FD]"
                            >
                              <option value="未分配">未分配</option>
                              {staffUsers.map((user) => (
                                <option key={`${room.id}-${user.id}`} value={user.name}>
                                  {user.name}
                                </option>
                              ))}
                            </select>

                            <div className="flex justify-end">
                              <RoomMiniProgress value={roomProgress(room)} />
                            </div>

                            <div className="flex justify-end">
                              <button
                                onClick={() => handleDeleteActivityRoom(room.id)}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E2E8F0] text-xs text-[#475569] transition hover:bg-[#d6dfeb] focus:outline-none focus:ring-2 focus:ring-[#93C5FD]"
                              >
                                -
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-6 text-center text-xs text-[#94A3B8]">目前此狀態沒有房間</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {adminView === "activity" && (
              <div className="rounded-[28px] border border-[#D9E2EC] bg-white p-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <SectionTitle title="活動列表" sub="點選活動後顯示整頁安排" icon={<CalendarDays className="h-4 w-4" />} />
                  <button
                    onClick={() => setActivityModal({ open: true, mode: "add", id: "", date: "", name: "", contact: "", category: "活動", requiresCleaning: true })}
                    className="rounded-full bg-[#0F172A] px-2.5 py-1 text-sm font-semibold text-white shadow-sm"
                  >
                    +
                  </button>
                </div>

                <div className="space-y-2">
                  {cleaningActivities.map((activity) => {
                    const active = selectedActivity?.id === activity.id;
                    return (
                      <div key={activity.id} className={`rounded-[18px] border px-3 py-2.5 transition ${active ? "border-[#0F172A] bg-[#0F172A] text-white" : "border-[#D9E2EC] bg-white hover:bg-[#F8FBFF]"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <button onClick={() => setSelectedActivityId(activity.id)} className="min-w-0 flex-1 text-left">
                            <div className="truncate text-sm font-medium">{formatActivityDate(activity.date)} {activity.name}</div>
                          </button>
                          <button onClick={() => openEditActivityModal(activity)} className={`rounded-full px-2 py-1 text-[10px] ${active ? "bg-white/10 text-white" : "bg-[#E2E8F0] text-[#475569]"}`}>
                            ✎
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedActivity && (
                  <>
                    <div className="mt-4 rounded-[22px] bg-[linear-gradient(135deg,#f8fbff_0%,#eef5ff_100%)] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs text-[#64748B]">{formatActivityDate(selectedActivity.date)}｜{selectedActivity.contact}</div>
                          <div className="mt-1 flex items-center gap-2 text-lg font-semibold tracking-tight">
                            <CalendarDays className="h-4.5 w-4.5 text-[#22426A]" />
                            {selectedActivity.name}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setShowStaffFilter((prev) => !prev)} className="rounded-full bg-white px-2.5 py-1 text-sm font-semibold text-[#334155] shadow-sm">
                            👤
                          </button>
                          <button onClick={() => setActivityRoomModal((prev) => ({ ...prev, open: true }))} className="rounded-full bg-[#0F172A] px-2.5 py-1 text-sm font-semibold text-white shadow-sm">
                            +
                          </button>
                        </div>
                      </div>

                      {showStaffFilter && (
                        <div className="mt-2 rounded-[20px] border border-[#CBD5E1] bg-white p-2 shadow-[0_10px_20px_rgba(15,23,42,0.06)]">
                          <button
                            onClick={() => {
                              setActivityStaffFilter("all");
                              setShowStaffFilter(false);
                            }}
                            className={`mb-1 w-full rounded-xl px-3 py-2 text-left text-sm ${activityStaffFilter === "all" ? "bg-[#0F172A] text-white" : "bg-[#F1F5F9] text-[#334155]"}`}
                          >
                            全部打掃人
                          </button>
                          {staffUsers.map((user) => (
                            <button
                              key={user.id}
                              onClick={() => {
                                setActivityStaffFilter(user.name);
                                setShowStaffFilter(false);
                              }}
                              className={`mb-1 w-full rounded-xl px-3 py-2 text-left text-sm ${activityStaffFilter === user.name ? "bg-[#0F172A] text-white" : "bg-[#F1F5F9] text-[#334155]"}`}
                            >
                              {user.name}
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        {[
                          { key: "all", label: "全部" },
                          { key: "A", label: "A棟" },
                          { key: "B", label: "B棟" },
                        ].map((item) => (
                          <button
                            key={item.key}
                            onClick={() => {
                              setActivitySelectedBuilding(item.key as "all" | BuildingType);
                              setActivitySelectedFloor("all");
                            }}
                            className={`rounded-xl px-2.5 py-1 text-xs font-medium transition ${activitySelectedBuilding === item.key ? "bg-[#0F172A] text-white shadow-sm" : "border border-[#CBD5E1] bg-white text-[#334155]"}`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <button
                          onClick={() => setActivitySelectedFloor("all")}
                          className={`rounded-xl px-2.5 py-1 text-xs font-medium transition ${activitySelectedFloor === "all" ? "bg-[#0F172A] text-white shadow-sm" : "border border-[#CBD5E1] bg-white text-[#334155]"}`}
                        >
                          全部
                        </button>
                        {activityAvailableFloors.map((floor) => (
                          <button
                            key={floor}
                            onClick={() => setActivitySelectedFloor(String(floor))}
                            className={`rounded-xl px-2.5 py-1 text-xs font-medium transition ${activitySelectedFloor === String(floor) ? "bg-[#0F172A] text-white shadow-sm" : "border border-[#CBD5E1] bg-white text-[#334155]"}`}
                          >
                            {formatFloorLabel(floor)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 rounded-[20px] border border-[#D9E2EC] bg-[#F8FBFF] p-2">
                      <div className="space-y-2">
                        {activityDisplayRooms.map((room) => (
                          <div key={room.id} className="rounded-[18px] border border-[#D9E2EC] bg-white px-3 py-3 shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
                            <div className="flex items-center gap-2 text-sm font-medium leading-6 text-[#0F172A]">
                              <DoorClosed className="h-4 w-4 shrink-0 text-[#22426A]" />
                              <span className="truncate">{roomLabel(room)}</span>
                            </div>

                            <div className="mt-3 grid grid-cols-[1fr_148px_84px_34px] items-center gap-2">
                              <input
                                value={room.occupant || ""}
                                onChange={(e) => handleChangeActivityOccupant(room.id, e.target.value)}
                                className="h-12 w-full rounded-[16px] border border-[#CBD5E1] bg-[#FBFDFF] px-3 text-sm text-[#334155] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#93C5FD]"
                                placeholder="住宿人"
                              />

                              <select
                                value={room.assignedTo}
                                onChange={(e) => handleAssignActivityRoomToStaff(room.id, e.target.value)}
                                className="h-12 w-full rounded-[16px] border border-[#CBD5E1] bg-[#FBFDFF] px-3 text-sm text-[#334155] focus:outline-none focus:ring-2 focus:ring-[#93C5FD]"
                              >
                                <option value="未分配">未分配</option>
                                {staffUsers.map((user) => (
                                  <option key={`${room.id}-${user.id}`} value={user.name}>
                                    {user.name}
                                  </option>
                                ))}
                              </select>

                              <div className="flex justify-end">
                                <RoomMiniProgress value={roomProgress(room)} />
                              </div>

                              <div className="flex justify-end">
                                <button
                                  onClick={() => handleDeleteActivityRoom(room.id)}
                                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E2E8F0] text-xs text-[#475569] transition hover:bg-[#d6dfeb] focus:outline-none focus:ring-2 focus:ring-[#93C5FD]"
                                >
                                  -
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {adminView === "calendar" && (
              <div className="rounded-[28px] border border-[#D9E2EC] bg-white p-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <SectionTitle title="日曆 / 活動管理" sub="點日期可快速新增活動；需打掃才會同步到活動列表" icon={<CalendarDays className="h-4 w-4" />} />
                  <button
                    onClick={() => setActivityModal({ open: true, mode: "add", id: "", date: "", name: "", contact: "", category: "一般活動", requiresCleaning: false })}
                    className="rounded-full bg-[#0F172A] px-2.5 py-1 text-sm font-semibold text-white shadow-sm"
                  >
                    +
                  </button>
                </div>

                <div className="rounded-[22px] border border-[#D9E2EC] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                      className="rounded-full bg-[#E2E8F0] p-2 text-[#334155] transition hover:bg-[#d9e3ef]"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="text-sm font-semibold text-[#0F172A]">{getMonthLabel(calendarMonth)}</div>
                    <button
                      onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                      className="rounded-full bg-[#E2E8F0] p-2 text-[#334155] transition hover:bg-[#d9e3ef]"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 pb-2">
                    {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
                      <div key={day} className="py-1 text-center text-[11px] font-semibold text-[#64748B]">
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day) => {
                      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
                      const dayActivities = activitiesByDate.get(key) || [];
                      const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                      const isToday = isSameDate(day, new Date());
                      return (
                        <button
                          key={key}
                          onClick={() =>
                            setActivityModal({
                              open: true,
                              mode: "add",
                              id: "",
                              date: key,
                              name: "",
                              contact: "",
                              category: "一般活動",
                              requiresCleaning: false,
                            })
                          }
                          className={`min-h-[88px] rounded-[16px] border p-2 text-left align-top transition ${isCurrentMonth ? "border-[#D9E2EC] bg-white hover:bg-[#F8FBFF]" : "border-[#E7EDF5] bg-[#F8FAFC] text-[#94A3B8]"}`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${isToday ? "bg-[#0F172A] text-white" : isCurrentMonth ? "text-[#0F172A]" : "text-[#94A3B8]"}`}>
                              {day.getDate()}
                            </span>
                            {dayActivities.length > 0 && <span className="text-[10px] text-[#64748B]">{dayActivities.length}項</span>}
                          </div>
                          <div className="mt-2 space-y-1">
                            {dayActivities.slice(0, 3).map((activity) => (
                              <div key={activity.id} className={`truncate rounded-full px-2 py-0.5 text-[10px] ${activity.requiresCleaning ? "bg-[#DBEAFE] text-[#1D4ED8]" : "bg-[#F1F5F9] text-[#475569]"}`}>
                                {activity.name}
                              </div>
                            ))}
                            {dayActivities.length > 3 && <div className="text-[10px] text-[#64748B]">+{dayActivities.length - 3} 更多</div>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {adminView === "staff" && (
              <div className="rounded-[28px] border border-[#D9E2EC] bg-white p-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                <div className="rounded-[22px] bg-[linear-gradient(135deg,#f8fbff_0%,#eef5ff_100%)] p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-lg font-semibold tracking-tight">
                    <Users className="h-5 w-5 text-[#22426A]" />
                    打掃人員名單
                  </div>
                  <div className="mt-1 text-xs text-[#64748B]">點選人員可查看負責房間</div>
                </div>

                <div className="mt-3 space-y-2">
                  {staffUsers.map((user) => {
                    const assignedRooms = latestActivityRooms.filter((room) => room.assignedTo === user.name);
                    const completedRooms = assignedRooms.filter((room) => room.status === "completed").length;
                    const expanded = selectedStaffName === user.name;
                    return (
                      <div key={user.id} className="rounded-[18px] border border-[#D9E2EC] bg-white px-3 py-2.5 shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
                        <button
                          onClick={() => {
                            setSelectedStaffName(user.name);
                            setExpandedStaffRooms([]);
                          }}
                          className="flex w-full items-center justify-between gap-3 text-left"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-[#0F172A]">{user.name}</div>
                            <div className="mt-1 text-[11px] text-[#64748B]">{latestActivity ? latestActivity.name : "目前無打掃活動"}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <InfoPill>房數 {assignedRooms.length}</InfoPill>
                            <InfoPill>{completedRooms}/{assignedRooms.length}</InfoPill>
                          </div>
                        </button>

                        {expanded && (
                          <div className="mt-2 space-y-2 rounded-[16px] bg-[#F8FAFC] p-2">
                            {assignedRooms.length > 0 ? (
                              assignedRooms.map((room) => {
                                const roomExpanded = expandedStaffRooms.includes(room.id);
                                return (
                                  <div key={room.id} className="rounded-[16px] border border-[#E2E8F0] bg-white px-2.5 py-2">
                                    <button
                                      onClick={() => setExpandedStaffRooms((prev) => (prev.includes(room.id) ? prev.filter((id) => id !== room.id) : [...prev, room.id]))}
                                      className="flex w-full items-center justify-between gap-2 text-left"
                                    >
                                      <div className="flex items-center gap-2 text-sm font-medium text-[#0F172A]">
                                        <DoorClosed className="h-4 w-4 text-[#22426A]" />
                                        {roomLabel(room)}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <StatusBadge status={room.status} />
                                        <InfoPill>{roomProgress(room)}%</InfoPill>
                                        <ChevronDown className={`h-4 w-4 text-[#64748B] transition ${roomExpanded ? "rotate-180" : "rotate-0"}`} />
                                      </div>
                                    </button>

                                    {roomExpanded && (
                                      <div className="mt-2 space-y-1 rounded-[12px] bg-[#F8FAFC] p-2">
                                        {room.checklist.map((item) => (
                                          <div key={item.id} className="flex items-center justify-between gap-2 text-xs text-[#334155]">
                                            <span className="inline-flex items-center gap-1.5">
                                              <ListTodo className="h-3.5 w-3.5 text-[#64748B]" />
                                              {item.label}
                                            </span>
                                            <span>
                                              {item.subItems.filter((sub) => sub.done).length}/{item.subItems.length}
                                              {item.requiredPhoto ? ` ・ ${item.photo ? "已拍" : "未拍"}` : ""}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              <div className="text-center text-xs text-[#94A3B8]">目前沒有負責房間</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {viewMode === "admin" && (
        <div className="fixed inset-x-0 bottom-0 border-t border-[#D9E2EC] bg-white/95 px-3 py-3 backdrop-blur shadow-[0_-10px_24px_rgba(15,23,42,0.08)]">
          <div className="mx-auto grid max-w-md grid-cols-4 gap-2">
            <button onClick={() => setAdminView("activity")} className={`rounded-[18px] px-2 py-2 text-xs font-medium ${adminView === "activity" ? "bg-[#0F172A] text-white" : "bg-[#E2E8F0] text-[#334155]"}`}>
              活動列表
            </button>
            <button onClick={() => setAdminView("staff")} className={`rounded-[18px] px-2 py-2 text-xs font-medium ${adminView === "staff" ? "bg-[#0F172A] text-white" : "bg-[#E2E8F0] text-[#334155]"}`}>
              打掃人名單
            </button>
            <button onClick={() => setAdminView("calendar")} className={`rounded-[18px] px-2 py-2 text-xs font-medium ${adminView === "calendar" ? "bg-[#0F172A] text-white" : "bg-[#E2E8F0] text-[#334155]"}`}>
              <span className="inline-flex items-center justify-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                日曆
              </span>
            </button>
            <button onClick={() => setAdminView("overview")} className={`rounded-[18px] px-2 py-2 text-xs font-medium ${adminView === "overview" ? "bg-[#0F172A] text-white" : "bg-[#E2E8F0] text-[#334155]"}`}>
              <span className="inline-flex items-center justify-center gap-1">
                <Wrench className="h-3.5 w-3.5" />
                現況
              </span>
            </button>
          </div>
        </div>
      )}

      {photoModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/40 p-4" onClick={() => setPhotoModal({ open: false, roomId: "", itemId: "" })}>
          <div className="w-full max-w-sm rounded-[28px] bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.14)]" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-semibold">請先上傳照片</div>
            <div className="mt-2 text-sm leading-6 text-[#475569]">勾選完成前，請先上傳照片，避免漏拍或誤點。</div>
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setPhotoModal({ open: false, roomId: "", itemId: "" })} className="rounded-[20px] bg-[#E2E8F0] px-3 py-2 text-sm font-medium text-[#334155]">
                取消
              </button>
              <button onClick={() => triggerUpload(photoModal.roomId, photoModal.itemId)} className="rounded-[20px] bg-[#0F172A] px-3 py-2 text-sm font-medium text-white">
                上傳照片
              </button>
            </div>
          </div>
        </div>
      )}

      {activityModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/40 p-4" onClick={() => setActivityModal({ open: false, mode: "add", id: "", date: "", name: "", contact: "", category: "活動", requiresCleaning: true })}>
          <div className="w-full max-w-sm rounded-[28px] bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.14)]" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-semibold">{activityModal.mode === "add" ? "新增活動" : "編輯活動"}</div>
            <div className="mt-3 space-y-3">
              <input type="date" value={activityModal.date} onChange={(e) => setActivityModal((prev) => ({ ...prev, date: e.target.value }))} className="w-full rounded-[20px] border border-[#CBD5E1] bg-[#FBFDFF] px-3 py-2.5 text-sm" />
              <select value={activityModal.category} onChange={(e) => setActivityModal((prev) => ({ ...prev, category: e.target.value as ActivityCategory }))} className="w-full rounded-[20px] border border-[#CBD5E1] bg-[#FBFDFF] px-3 py-2.5 text-sm">
                {activityCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <input value={activityModal.name} onChange={(e) => setActivityModal((prev) => ({ ...prev, name: e.target.value }))} className="w-full rounded-[20px] border border-[#CBD5E1] bg-[#FBFDFF] px-3 py-2.5 text-sm" placeholder="活動名稱" />
              <input value={activityModal.contact} onChange={(e) => setActivityModal((prev) => ({ ...prev, contact: e.target.value }))} className="w-full rounded-[20px] border border-[#CBD5E1] bg-[#FBFDFF] px-3 py-2.5 text-sm" placeholder="聯絡人" />
              <label className="flex items-center justify-between rounded-[18px] border border-[#CBD5E1] bg-[#FBFDFF] px-3 py-2.5 text-sm">
                <span>是否需要打掃</span>
                <input type="checkbox" checked={activityModal.requiresCleaning} onChange={(e) => setActivityModal((prev) => ({ ...prev, requiresCleaning: e.target.checked }))} className="h-4 w-4" />
              </label>
            </div>
            <div className="mt-4 flex justify-between gap-2">
              <div>
                {activityModal.mode === "edit" && (
                  <button onClick={handleDeleteActivity} className="rounded-[20px] bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">
                    刪除
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                {activityModal.mode === "edit" && (
                  <button onClick={handleDuplicateActivity} className="rounded-[20px] bg-[#E2E8F0] px-3 py-2 text-sm font-medium text-[#334155]">
                    複製
                  </button>
                )}
                <button onClick={() => setActivityModal({ open: false, mode: "add", id: "", date: "", name: "", contact: "", category: "活動", requiresCleaning: true })} className="rounded-[20px] bg-[#E2E8F0] px-3 py-2 text-sm font-medium text-[#334155]">
                  取消
                </button>
                <button onClick={saveActivity} className="rounded-[20px] bg-[#0F172A] px-3 py-2 text-sm font-medium text-white">
                  儲存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activityRoomModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/40 p-4" onClick={() => setActivityRoomModal((prev) => ({ ...prev, open: false }))}>
          <div className="w-full max-w-sm rounded-[28px] bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.14)]" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-semibold">新增房間</div>
            <div className="mt-3 space-y-3">
              <select value={activityRoomModal.building} onChange={(e) => setActivityRoomModal((prev) => ({ ...prev, building: e.target.value as BuildingType }))} className="w-full rounded-[20px] border border-[#CBD5E1] bg-[#FBFDFF] px-3 py-2.5 text-sm">
                <option value="A">A棟</option>
                <option value="B">B棟</option>
              </select>
              <input value={activityRoomModal.floor} onChange={(e) => setActivityRoomModal((prev) => ({ ...prev, floor: e.target.value.replace(/[^0-9]/g, "").slice(0, 2) }))} className="w-full rounded-[20px] border border-[#CBD5E1] bg-[#FBFDFF] px-3 py-2.5 text-sm" placeholder="樓層" />
              <input value={activityRoomModal.roomName} onChange={(e) => setActivityRoomModal((prev) => ({ ...prev, roomName: e.target.value }))} className="w-full rounded-[20px] border border-[#CBD5E1] bg-[#FBFDFF] px-3 py-2.5 text-sm" placeholder="房號 / 空間名稱" />
              <textarea value={activityRoomModal.occupant} onChange={(e) => setActivityRoomModal((prev) => ({ ...prev, occupant: e.target.value }))} className="h-10 w-full rounded-[20px] border border-[#CBD5E1] bg-[#FBFDFF] px-3 py-2.5 text-sm leading-5 resize-none overflow-hidden" placeholder="住宿人" rows={1} />
              <select value={activityRoomModal.staffName} onChange={(e) => setActivityRoomModal((prev) => ({ ...prev, staffName: e.target.value }))} className="w-full rounded-[20px] border border-[#CBD5E1] bg-[#FBFDFF] px-3 py-2.5 text-sm">
                <option value="未分配">未分配</option>
                {staffUsers.map((user) => (
                  <option key={user.id} value={user.name}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setActivityRoomModal((prev) => ({ ...prev, open: false }))} className="rounded-[20px] bg-[#E2E8F0] px-3 py-2 text-sm font-medium text-[#334155]">
                取消
              </button>
              <button onClick={saveActivityRoom} className="rounded-[20px] bg-[#0F172A] px-3 py-2 text-sm font-medium text-white">
                新增
              </button>
            </div>
          </div>
        </div>
      )}

      {staffModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/40 p-4" onClick={() => setStaffModal({ open: false, mode: "add", id: "", name: "", note: "" })}>
          <div className="w-full max-w-sm rounded-[28px] bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.14)]" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-semibold">{staffModal.mode === "add" ? "新增人員" : "編輯人員"}</div>
            <div className="mt-3 space-y-3">
              <input value={staffModal.name} onChange={(e) => setStaffModal((prev) => ({ ...prev, name: e.target.value }))} className="w-full rounded-[20px] border border-[#CBD5E1] bg-[#FBFDFF] px-3 py-2.5 text-sm" placeholder="人員姓名" />
              <input value={staffModal.note} onChange={(e) => setStaffModal((prev) => ({ ...prev, note: e.target.value }))} className="w-full rounded-[20px] border border-[#CBD5E1] bg-[#FBFDFF] px-3 py-2.5 text-sm" placeholder="備註" />
            </div>
            <div className="mt-4 flex justify-between gap-2">
              <div>
                {staffModal.mode === "edit" && (
                  <button onClick={() => setStaffUsers((prev) => prev.filter((user) => user.id !== staffModal.id))} className="rounded-[20px] bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">
                    刪除
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStaffModal({ open: false, mode: "add", id: "", name: "", note: "" })} className="rounded-[20px] bg-[#E2E8F0] px-3 py-2 text-sm font-medium text-[#334155]">
                  取消
                </button>
                <button onClick={saveStaff} className="rounded-[20px] bg-[#0F172A] px-3 py-2 text-sm font-medium text-white">
                  儲存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}