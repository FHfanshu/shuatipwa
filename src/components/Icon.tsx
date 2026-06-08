import type { FC } from 'react';
import {
  Book,
  Home,
  Import,
  Upload,
  Settings,
  Star,
  CheckCircle,
  XCircle,
  Trash2,
  Pencil,
  Folder,
  FileText,
  Download,
  Clock,
  RotateCw,
  List,
  Shuffle,
  ClipboardList,
  Trophy,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Lightbulb,
  Info,
  Check,
  X,
  HelpCircle,
  Smartphone,
  Infinity as InfinityIcon,
  Zap,
  Circle,
  Redo,
  Play,
  Database,
  Copy,
  Moon,
  Sun,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface IconProps {
  name: string;
  className?: string;
  size?: number;
}

const ICON_MAP: Record<string, LucideIcon> = {
  book: Book,
  home: Home,
  import: Import,
  upload: Upload,
  settings: Settings,
  star: Star,
  'star-empty': Star,
  'check-circle': CheckCircle,
  'x-circle': XCircle,
  trash: Trash2,
  pencil: Pencil,
  folder: Folder,
  'file-text': FileText,
  download: Download,
  clock: Clock,
  refresh: RotateCw,
  'refresh-cw': RotateCw,
  list: List,
  shuffle: Shuffle,
  exam: ClipboardList,
  trophy: Trophy,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'chevron-right': ChevronRight,
  lightbulb: Lightbulb,
  info: Info,
  check: Check,
  x: X,
  'help-circle': HelpCircle,
  smartphone: Smartphone,
  infinite: InfinityIcon,
  zap: Zap,
  circle: Circle,
  redo: Redo,
  play: Play,
  database: Database,
  copy: Copy,
  moon: Moon,
  sun: Sun,
};

const Icon: FC<IconProps> = ({ name, className = '', size = 20 }) => {
  const Comp = ICON_MAP[name];
  if (!Comp) {
    if (import.meta.env.DEV) console.warn(`Unknown icon: ${name}`);
    return <Circle size={size} className={className} />;
  }
  const props: Record<string, unknown> = { size, className: `inline-flex items-center justify-center ${className}` };
  if (name === 'star-empty') props.fill = 'none';
  return <Comp {...props} />;
};

export default Icon;
