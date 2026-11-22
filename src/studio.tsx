import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  Grid2X2,
  Film,
  Download,
  Undo2,
  Redo2,
  Play,
  Pause,
  Plus,
  Copy,
  Trash2,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Pencil,
  Eraser,
  PaintBucket,
  FlipHorizontal2,
  Layers2,
  Upload,
  Search,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import {
  NumberField,
  NumberFieldGroup,
  NumberFieldInput,
  NumberFieldDecrement,
  NumberFieldIncrement,
} from "@/components/ui/number-field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Studio, StudioState } from "@/lib/studio-engine";

import {
  Choice,
  IconButton,
  Section,
  Range,
  Toggle,
  ColorField,
} from "@/components/editor-controls";
const StudioDialogs = lazy(() => import("@/components/studio-dialogs"));

const initial: StudioState = {
  mode: "pattern",
  cols: 5,
  rows: 5,
  shape: "circle",
  dotSize: 12,
  gap: 6,
  colorMode: "solid",
  colorA: "#e4e4e7",
  colorB: "#22d3ee",
  gradDir: "diagonal",
  bg: "#0b0b0f",
  base: 0.12,
  glow: false,
  scaleFx: false,
  hideOff: false,
  preset: "ripple",
  duration: 1600,
  reverse: false,
  frameMs: 100,
  cur: 0,
  onion: true,
  tool: "pen",
  brush: 1,
  genPreset: "radar",
  genCount: 12,
  previewTheme: "dark",
  codeTab: "react",
  gifScale: 2,
  gifTransparent: false,
  brailleThreshold: 0.5,
  playing: true,
  canUndo: false,
  canRedo: false,
  frameCount: 12,
  presetName: "涟漪",
  litCount: 25,
  modal: null,
  code: "",
  codeMeta: "",
  gifUrl: "",
  gifMeta: "",
  gifBusy: false,
  gifProgress: 0,
  message: "",
};
const noopSubscribe = () => () => {};
const initialSnapshot = () => initial;
export function App() {
  const [api, setApi] = useState<Studio | null>(null);
  const state = useSyncExternalStore(
    api?.subscribe ?? noopSubscribe,
    api?.getSnapshot ?? initialSnapshot,
  );
  const s = state;
  const [inspector, setInspector] = useState("style");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [help, setHelp] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let cancelled = false,
      studio: Studio | undefined;
    void import("@/lib/studio-engine").then(({ createStudio }) => {
      if (cancelled) return;
      studio = createStudio();
      setApi(studio);
    });
    return () => {
      cancelled = true;
      studio?.destroy();
    };
  }, []);
  const set = (key: string, value: string | number | boolean) =>
    api?.set(key, value);
  const action = (name: string, arg?: number[]) => api?.action(name, arg);
  const isSeq = s.mode === "sequence";
  const visiblePresets =
    api?.presets.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()),
    ).length ?? 19;
  return (
    <TooltipProvider delay={450}>
      <div className="studio-app">
        <a href="#editor" className="skip-link">
          跳到画布
        </a>
        <header className="studio-header">
          <a className="brand" href="./" aria-label="Dot Loader Studio 首页">
            <span className="brand-dots" aria-hidden="true">
              {Array.from({ length: 9 }, (_, i) => (
                <i key={i} />
              ))}
            </span>
            <span>
              Dot Loader <strong>Studio</strong>
            </span>
          </a>
          <div className="mode-control">
            <Choice
              label="创建方式"
              value={s.mode}
              onChange={(v) => set("mode", v)}
              options={[
                [
                  "pattern",
                  <>
                    <Grid2X2 />
                    预设动画
                  </>,
                ],
                [
                  "sequence",
                  <>
                    <Film />
                    逐帧绘制
                  </>,
                ],
              ]}
            />
          </div>
          <div className="header-actions">
            <span className="autosave">
              <span />
              本地自动保存
            </span>
            <IconButton
              label="导入项目"
              onClick={() => fileRef.current?.click()}
            >
              <Upload />
            </IconButton>
            <Button
              disabled={!api}
              id="export-trigger"
              onClick={() => action("export")}
            >
              <Download />
              <span>导出</span>
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void api?.importFile(file);
              e.target.value = "";
            }}
          />
        </header>
        <main className="workspace" aria-busy={!api}>
          <aside
            className={`library-panel ${libraryOpen ? "is-open" : ""}`}
            aria-label="动画库"
          >
            <div className="panel-heading">
              <div>
                <h2>{isSeq ? "序列起点" : "动画库"}</h2>
                <p>
                  {isSeq
                    ? "选择起点，再生成可编辑的序列。"
                    : "选择一个动画，调整为你的样式。"}
                </p>
              </div>
              <button
                className="mobile-library-toggle"
                aria-label="收起动画库"
                onClick={() => setLibraryOpen(false)}
              >
                <ChevronUp />
              </button>
            </div>
            <div className="library-content">
              {isSeq && (
                <div className="sequence-source">
                  <Range
                    label="生成帧数"
                    value={s.genCount}
                    min={4}
                    max={32}
                    onChange={(v) => set("genCount", v)}
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => action("generate")}
                  >
                    生成序列帧
                  </Button>
                  <p className="section-note">替换当前序列，可撤销。</p>
                </div>
              )}
              <div className="library-search">
                <Search />
                <Input
                  aria-label="搜索动画"
                  placeholder="搜索动画…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    api?.filter(e.target.value);
                  }}
                />
              </div>
              <div className="library-caption">
                <span>预设</span>
                <span>{visiblePresets} / 19</span>
              </div>
              <div
                id="gallery"
                className="preset-gallery"
                aria-label="动画预设"
              />
              {visiblePresets === 0 && (
                <p className="empty-search">没有匹配的动画，请尝试其他名称。</p>
              )}
              <p className="library-footnote">
                选择预设不会覆盖已绘制的序列帧。
              </p>
            </div>
          </aside>
          <section
            className="editor-panel"
            id="editor"
            aria-label="动画编辑画布"
            tabIndex={-1}
          >
            <div className="editor-heading">
              <div>
                <div className="eyebrow">{isSeq ? "逐帧编辑" : "预设编辑"}</div>
                <h1>
                  {isSeq ? "自定义序列" : s.presetName}
                  <span>
                    {s.cols} × {s.rows}
                  </span>
                </h1>
              </div>
              <div className="history-controls">
                <IconButton
                  label="撤销 · ⌘Z"
                  onClick={() => action("undo")}
                  disabled={!s.canUndo}
                >
                  <Undo2 />
                </IconButton>
                <IconButton
                  label="重做 · ⇧⌘Z"
                  onClick={() => action("redo")}
                  disabled={!s.canRedo}
                >
                  <Redo2 />
                </IconButton>
              </div>
            </div>
            <div className="canvas-toolbar">
              {isSeq ? (
                <>
                  <Choice
                    label="绘制工具"
                    value={s.tool}
                    onChange={(v) => set("tool", v)}
                    options={[
                      [
                        "pen",
                        <>
                          <Pencil />
                          画笔
                        </>,
                      ],
                      [
                        "eraser",
                        <>
                          <Eraser />
                          橡皮
                        </>,
                      ],
                      [
                        "fill",
                        <>
                          <PaintBucket />
                          填充
                        </>,
                      ],
                    ]}
                  />
                  <div className="toolbar-divider" />
                  <Select
                    items={[
                      { value: "1", label: "100%" },
                      { value: "0.66", label: "66%" },
                      { value: "0.33", label: "33%" },
                    ]}
                    value={String(s.brush)}
                    onValueChange={(v) => set("brush", Number(v))}
                  >
                    <SelectTrigger
                      aria-label="画笔亮度"
                      className="brush-select"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectPopup>
                      {["1", "0.66", "0.33"].map((v) => (
                        <SelectItem key={v} value={v}>
                          {Math.round(Number(v) * 100)}%
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </>
              ) : (
                <>
                  <span className="toolbar-label">选区</span>
                  <Select
                    items={[
                      "all",
                      "circle",
                      "ring",
                      "cross",
                      "x",
                      "diamond",
                      "border",
                      "random",
                    ].map((value, i) => ({
                      value,
                      label: [
                        "全部",
                        "圆形",
                        "圆环",
                        "十字",
                        "X 形",
                        "菱形",
                        "边框",
                        "随机",
                      ][i],
                    }))}
                    defaultValue="all"
                    onValueChange={(v) => v && api?.mask(v)}
                  >
                    <SelectTrigger
                      aria-label="快速选区"
                      className="mask-select"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectPopup>
                      {[
                        "all",
                        "circle",
                        "ring",
                        "cross",
                        "x",
                        "diamond",
                        "border",
                        "random",
                      ].map((v, i) => (
                        <SelectItem key={v} value={v}>
                          {
                            [
                              "全部",
                              "圆形",
                              "圆环",
                              "十字",
                              "X 形",
                              "菱形",
                              "边框",
                              "随机",
                            ][i]
                          }
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => api?.mask("invert")}
                  >
                    反选
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => api?.mask("none")}
                  >
                    清空
                  </Button>
                </>
              )}
              <div className="toolbar-spacer" />
              <IconButton label="快捷键" onClick={() => setHelp(true)}>
                <CircleHelp />
              </IconButton>
            </div>
            <div id="stageWrap" className="stage-wrap">
              <canvas
                id="stage"
                aria-label={
                  isSeq
                    ? "点阵绘制画布，左键绘制，右键擦除"
                    : "动画选区画布，点击或拖动格子以切换选区"
                }
              />
              <span className="stage-corner">
                {isSeq
                  ? `FRAME ${String(s.cur + 1).padStart(2, "0")}`
                  : "CANVAS"}
              </span>
            </div>
            <div className="playback-bar">
              <Button
                variant="outline"
                size="sm"
                aria-label={s.playing ? "暂停动画" : "播放动画"}
                onClick={() => action("play")}
              >
                {s.playing ? <Pause /> : <Play />}
                {s.playing ? "暂停" : "播放"}
              </Button>
              <span>
                {isSeq
                  ? `${s.cur + 1} / ${s.frameCount} 帧`
                  : `${(s.duration / 1000).toFixed(2)} 秒 / 循环`}
              </span>
              <div className="toolbar-spacer" />
              <span className="canvas-instruction">
                {isSeq ? "左键绘制 · 右键擦除" : "点击或拖拽格子编辑选区"}
                <kbd>Space</kbd>
              </span>
            </div>
            <div className="timeline" hidden={!isSeq}>
              <div className="timeline-heading">
                <h2>
                  时间轴 <span>{s.frameCount} 帧</span>
                </h2>
                <div>
                  <IconButton
                    label="上一帧 · ←"
                    onClick={() => action("previous")}
                  >
                    <ArrowLeft />
                  </IconButton>
                  <IconButton label="下一帧 · →" onClick={() => action("next")}>
                    <ArrowRight />
                  </IconButton>
                  <span className="toolbar-divider" />
                  <IconButton
                    label="新建空白帧 · N"
                    onClick={() => action("add")}
                  >
                    <Plus />
                  </IconButton>
                  <IconButton
                    label="复制当前帧 · D"
                    onClick={() => action("duplicate")}
                  >
                    <Copy />
                  </IconButton>
                  <IconButton
                    label="删除当前帧"
                    disabled={s.frameCount <= 1}
                    onClick={() => action("delete")}
                  >
                    <Trash2 />
                  </IconButton>
                </div>
              </div>
              <div id="strip" className="frame-strip" aria-label="序列帧" />
            </div>
            <Button
              className="browse-mobile"
              variant="outline"
              onClick={() => setLibraryOpen((v) => !v)}
            >
              <Grid2X2 />
              {libraryOpen ? "收起动画库" : `浏览动画库 · ${s.presetName}`}
              <ChevronDown />
            </Button>
          </section>
          <aside className="inspector-panel" aria-label="动画属性">
            <div className="panel-heading">
              <div>
                <h2>属性</h2>
              </div>
            </div>
            <Tabs
              value={inspector}
              onValueChange={(v) => setInspector(String(v))}
              className="inspector-tabs"
            >
              <TabsList
                variant="underline"
                className="inspector-tab-list"
                aria-label="属性分类"
              >
                <TabsTab value="style">样式</TabsTab>
                <TabsTab value="motion">动画</TabsTab>
                <TabsTab value="preview">预览</TabsTab>
              </TabsList>
              <TabsPanel value="style" keepMounted>
                <Section title="网格">
                  <div className="dimension-grid">
                    {(["cols", "rows"] as const).map((key, i) => (
                      <NumberField
                        key={key}
                        size="sm"
                        min={1}
                        max={16}
                        value={s[key]}
                        onValueChange={(v) => v !== null && set(key, v)}
                      >
                        <label htmlFor={`dimension-${key}`}>
                          {i === 0 ? "列数" : "行数"}
                        </label>
                        <NumberFieldGroup>
                          <NumberFieldDecrement
                            aria-label={`减少${i === 0 ? "列" : "行"}数`}
                          />
                          <NumberFieldInput
                            id={`dimension-${key}`}
                            aria-label={i === 0 ? "列数" : "行数"}
                          />
                          <NumberFieldIncrement
                            aria-label={`增加${i === 0 ? "列" : "行"}数`}
                          />
                        </NumberFieldGroup>
                      </NumberField>
                    ))}
                  </div>
                  <Range
                    label="点大小"
                    value={s.dotSize}
                    min={3}
                    max={40}
                    unit=" px"
                    onChange={(v) => set("dotSize", v)}
                  />
                  <Range
                    label="间距"
                    value={s.gap}
                    min={0}
                    max={24}
                    unit=" px"
                    onChange={(v) => set("gap", v)}
                  />
                </Section>
                <Section title="形状">
                  <Select
                    items={Object.entries(
                      api?.shapes ?? { circle: "圆形" },
                    ).map(([value, label]) => ({ value, label }))}
                    value={s.shape}
                    onValueChange={(v) => v && set("shape", v)}
                  >
                    <SelectTrigger aria-label="点形状">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectPopup>
                      {Object.entries(api?.shapes ?? { circle: "圆形" }).map(
                        ([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ),
                      )}
                    </SelectPopup>
                  </Select>
                </Section>
                <Section title="颜色">
                  <Choice
                    label="颜色模式"
                    value={s.colorMode}
                    onChange={(v) => set("colorMode", v)}
                    options={[
                      ["solid", "纯色"],
                      ["gradient", "渐变"],
                    ]}
                  />
                  <ColorField
                    label={s.colorMode === "solid" ? "点颜色" : "起始颜色"}
                    value={s.colorA}
                    onChange={(v) => set("colorA", v)}
                  />
                  {s.colorMode === "gradient" && (
                    <>
                      <ColorField
                        label="结束颜色"
                        value={s.colorB}
                        onChange={(v) => set("colorB", v)}
                      />
                      <Select
                        items={[
                          "horizontal",
                          "vertical",
                          "diagonal",
                          "radial",
                        ].map((value, i) => ({
                          value,
                          label: [
                            "水平渐变",
                            "垂直渐变",
                            "对角渐变",
                            "径向渐变",
                          ][i],
                        }))}
                        value={s.gradDir}
                        onValueChange={(v) => v && set("gradDir", v)}
                      >
                        <SelectTrigger aria-label="渐变方向">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectPopup>
                          {["horizontal", "vertical", "diagonal", "radial"].map(
                            (v, i) => (
                              <SelectItem key={v} value={v}>
                                {
                                  [
                                    "水平渐变",
                                    "垂直渐变",
                                    "对角渐变",
                                    "径向渐变",
                                  ][i]
                                }
                              </SelectItem>
                            ),
                          )}
                        </SelectPopup>
                      </Select>
                    </>
                  )}
                  <div className="swatches" aria-label="常用点颜色">
                    {api?.swatches.map((c) => (
                      <button
                        key={c}
                        aria-label={`点颜色 ${c}`}
                        aria-pressed={s.colorA === c}
                        onClick={() => set("colorA", c)}
                        style={{ background: c }}
                      >
                        {s.colorA === c && (
                          <Check
                            style={{
                              color: [
                                "#ffffff",
                                "#e4e4e7",
                                "#facc15",
                                "#a3e635",
                              ].includes(c)
                                ? "#242424"
                                : "#fff",
                            }}
                          />
                        )}
                      </button>
                    ))}
                  </div>
                  <ColorField
                    label="背景颜色"
                    value={s.bg}
                    onChange={(v) => set("bg", v)}
                  />
                </Section>
                <Section title="显示效果">
                  <Range
                    label="暗格亮度"
                    value={Math.round(s.base * 100)}
                    min={0}
                    max={60}
                    unit="%"
                    onChange={(v) => set("base", v / 100)}
                  />
                  <Toggle
                    label="发光"
                    checked={s.glow}
                    onChange={(v) => set("glow", v)}
                  />
                  <Toggle
                    label="随亮度缩放"
                    checked={s.scaleFx}
                    onChange={(v) => set("scaleFx", v)}
                  />
                  <Toggle
                    label="隐藏暗格"
                    checked={s.hideOff}
                    onChange={(v) => set("hideOff", v)}
                    hint="仅保留参与动画的点。"
                  />
                </Section>
              </TabsPanel>
              <TabsPanel value="motion" keepMounted>
                {!isSeq ? (
                  <>
                    <Section title="播放">
                      <Range
                        label="循环时长"
                        value={s.duration}
                        min={300}
                        max={5000}
                        step={50}
                        unit=" ms"
                        onChange={(v) => set("duration", v)}
                      />
                      <Toggle
                        label="反向播放"
                        checked={s.reverse}
                        onChange={(v) => set("reverse", v)}
                      />
                    </Section>
                    <Section
                      title="精细编辑"
                      description="将当前动画转换为可逐帧修改的序列。"
                    >
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => action("convert")}
                      >
                        <Film />
                        转为序列帧
                      </Button>
                    </Section>
                  </>
                ) : (
                  <>
                    <Section title="播放">
                      <Range
                        label="每帧时长"
                        value={s.frameMs}
                        min={30}
                        max={600}
                        step={10}
                        unit=" ms"
                        onChange={(v) => set("frameMs", v)}
                      />
                      <Toggle
                        label="洋葱皮"
                        checked={s.onion}
                        onChange={(v) => set("onion", v)}
                        hint="编辑时淡显上一帧，便于对齐。"
                      />
                    </Section>
                    <Section title="当前帧">
                      <div className="frame-tools">
                        {[
                          ["shift", [-1, 0], <ArrowLeft />, "整体左移"],
                          ["shift", [1, 0], <ArrowRight />, "整体右移"],
                          ["shift", [0, -1], <ArrowUp />, "整体上移"],
                          ["shift", [0, 1], <ArrowDown />, "整体下移"],
                          ["invert", [], <FlipHorizontal2 />, "反转亮度"],
                          ["clear", [], <Eraser />, "清空当前帧"],
                          ["earlier", [], <Layers2 />, "帧前移"],
                          ["later", [], <Layers2 />, "帧后移"],
                        ].map(([name, arg, icon, label]) => (
                          <IconButton
                            key={String(label)}
                            label={String(label)}
                            onClick={() =>
                              action(String(name), arg as number[])
                            }
                          >
                            {icon as ReactNode}
                          </IconButton>
                        ))}
                      </div>
                    </Section>
                  </>
                )}
              </TabsPanel>
              <TabsPanel value="preview" keepMounted>
                <Section
                  title="实际尺寸"
                  description="检查点阵在内容与按钮中的显示效果。"
                >
                  <Choice
                    label="预览背景"
                    value={s.previewTheme}
                    onChange={(v) => set("previewTheme", v)}
                    options={[
                      ["dark", "深色"],
                      ["light", "浅色"],
                    ]}
                  />
                  <div className={`preview-surface ${s.previewTheme}`}>
                    <div className="preview-center">
                      <canvas id="pv" />
                    </div>
                    <div className="preview-button">
                      <canvas id="pvBtn" />
                      <span>加载中</span>
                    </div>
                  </div>
                  <p className="section-note">预览不会改变导出的背景颜色。</p>
                </Section>
                <Section title="输出信息">
                  <dl className="output-info">
                    <dt>网格</dt>
                    <dd>
                      {s.cols} × {s.rows}
                    </dd>
                    <dt>原始尺寸</dt>
                    <dd>
                      {s.cols * s.dotSize + (s.cols - 1) * s.gap} ×{" "}
                      {s.rows * s.dotSize + (s.rows - 1) * s.gap} px
                    </dd>
                    <dt>形状</dt>
                    <dd>{api?.shapes[s.shape]}</dd>
                    <dt>时长</dt>
                    <dd>{isSeq ? s.frameCount * s.frameMs : s.duration} ms</dd>
                  </dl>
                </Section>
              </TabsPanel>
            </Tabs>
          </aside>
        </main>
        <div
          className="status-message"
          role="status"
          aria-live="polite"
          hidden={!s.message}
        >
          {s.message}
        </div>
        <Suspense fallback={null}>
          {api && (s.modal || help) && (
            <StudioDialogs s={s} api={api} help={help} setHelp={setHelp} />
          )}
        </Suspense>
      </div>
    </TooltipProvider>
  );
}
