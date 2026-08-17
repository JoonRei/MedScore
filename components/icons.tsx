import type { ComponentProps } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Archive01Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  BookOpen01Icon,
  Calendar03Icon,
  Cancel01Icon,
  ChartHistogramIcon,
  CheckmarkCircle01Icon,
  ClipboardIcon,
  DashboardSquare01Icon,
  Delete01Icon,
  Edit02Icon,
  Key01Icon,
  LockPasswordIcon,
  Logout03Icon,
  ReloadIcon,
  SchoolReportCardIcon,
  Search01Icon,
  Settings02Icon,
  Tick02Icon,
  UserBlock01Icon,
  UserCheck01Icon,
  UserGroupIcon,
  ViewIcon,
  ViewOffIcon,
} from "@hugeicons/core-free-icons";

type HugeIconProps = Omit<ComponentProps<typeof HugeiconsIcon>, "icon">;
type IconData = ComponentProps<typeof HugeiconsIcon>["icon"];

function makeIcon(icon: IconData) {
  return function MedIcon({ size = 20, strokeWidth = 1.7, color = "currentColor", ...props }: HugeIconProps) {
    return <HugeiconsIcon icon={icon} size={size} strokeWidth={strokeWidth} color={color} {...props} />;
  };
}

export const HomeIcon = makeIcon(DashboardSquare01Icon);
export const DeleteIcon = makeIcon(Delete01Icon);
export const UsersIcon = makeIcon(UserGroupIcon);
export const BookIcon = makeIcon(BookOpen01Icon);
export const FileIcon = makeIcon(ClipboardIcon);
export const ChartIcon = makeIcon(ChartHistogramIcon);
export const SettingsIcon = makeIcon(Settings02Icon);
export const LogoutIcon = makeIcon(Logout03Icon);
export const SearchIcon = makeIcon(Search01Icon);
export const LockIcon = makeIcon(LockPasswordIcon);
export const KeyIcon = makeIcon(Key01Icon);
export const CheckIcon = makeIcon(Tick02Icon);
export const ArrowRightIcon = makeIcon(ArrowRight01Icon);
export const ArrowLeftIcon = makeIcon(ArrowLeft01Icon);
export const ArrowDownIcon = makeIcon(ArrowDown01Icon);
export const EditIcon = makeIcon(Edit02Icon);
export const ArchiveIcon = makeIcon(Archive01Icon);
export const RestoreIcon = makeIcon(ReloadIcon);
export const CalendarIcon = makeIcon(Calendar03Icon);
export const CloseIcon = makeIcon(Cancel01Icon);
export const ActivateIcon = makeIcon(UserCheck01Icon);
export const DeactivateIcon = makeIcon(UserBlock01Icon);
export const ScoresIcon = makeIcon(SchoolReportCardIcon);
export const PublishIcon = makeIcon(ViewIcon);
export const UnpublishIcon = makeIcon(ViewOffIcon);
export const SuccessIcon = makeIcon(CheckmarkCircle01Icon);
