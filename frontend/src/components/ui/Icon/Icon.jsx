import {
  ArrowRight,
  ArrowUpRight,
  AtSign,
  BarChart3,
  Bell,
  Bug,
  Calendar,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Circle,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleHelp,
  Clock,
  Copy,
  Edit3,
  Eye,
  FileText,
  Filter,
  FolderKanban,
  GitCommit,
  GitPullRequest,
  History,
  Image,
  Inbox,
  Info,
  Kanban,
  Layers,
  LayoutGrid,
  Link,
  ListChecks,
  Mail,
  Maximize2,
  MessageSquare,
  MessageSquareText,
  MoreHorizontal,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Paperclip,
  Pencil,
  Plus,
  Quote,
  RefreshCw,
  Rocket,
  Search,
  Settings,
  Share2,
  Slash,
  Sparkles,
  Sun,
  Trash2,
  TrendingUp,
  User,
  UserCircle,
  Users,
  Video,
  X,
  Zap,
} from 'lucide-react';

/**
 * Stratos Icon — kebab-case wrapper over `lucide-react` so screens can
 * use the same `<Icon name="message-square" />` API as the design-file
 * mockups in `/Design Files/`. The registry below is explicit so the
 * bundler tree-shakes (a `import * as Lucide` namespace import pulls
 * every icon into the bundle).
 *
 * Adding a new icon: import it from lucide-react at the top, then add
 * the kebab-case key here.
 */
const REGISTRY = {
  'arrow-right': ArrowRight,
  'arrow-up-right': ArrowUpRight,
  'at-sign': AtSign,
  'bar-chart-3': BarChart3,
  bell: Bell,
  bug: Bug,
  calendar: Calendar,
  check: Check,
  'check-square': CheckSquare,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  'chevrons-up-down': ChevronsUpDown,
  circle: Circle,
  'circle-check': CircleCheck,
  'circle-dashed': CircleDashed,
  'circle-dot': CircleDot,
  'circle-help': CircleHelp,
  clock: Clock,
  copy: Copy,
  dot: Circle,
  'edit-3': Edit3,
  eye: Eye,
  'file-text': FileText,
  filter: Filter,
  'folder-kanban': FolderKanban,
  'git-commit': GitCommit,
  'git-pull-request': GitPullRequest,
  'help-circle': CircleHelp,
  history: History,
  image: Image,
  inbox: Inbox,
  info: Info,
  kanban: Kanban,
  layers: Layers,
  'layout-grid': LayoutGrid,
  link: Link,
  'list-checks': ListChecks,
  mail: Mail,
  maximize: Maximize2,
  'message-square': MessageSquare,
  'message-square-text': MessageSquareText,
  'more-horizontal': MoreHorizontal,
  moon: Moon,
  'panel-left-close': PanelLeftClose,
  'panel-left-open': PanelLeftOpen,
  paperclip: Paperclip,
  pencil: Pencil,
  plus: Plus,
  quote: Quote,
  'refresh-cw': RefreshCw,
  rocket: Rocket,
  search: Search,
  settings: Settings,
  'share-2': Share2,
  slash: Slash,
  sparkles: Sparkles,
  sun: Sun,
  trash: Trash2,
  'trending-up': TrendingUp,
  user: User,
  'user-circle': UserCircle,
  users: Users,
  video: Video,
  x: X,
  zap: Zap,
};

export function Icon({ name, size = 14, color, strokeWidth = 2, className, ...rest }) {
  const Cmp = REGISTRY[name];
  if (!Cmp) {
    if (import.meta.env?.DEV) {
      // eslint-disable-next-line no-console
      console.warn(`[Icon] unknown icon name "${name}" — add it to Icon.jsx REGISTRY.`);
    }
    return <svg width={size} height={size} aria-hidden="true" />;
  }
  return (
    <Cmp
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
      {...rest}
    />
  );
}
