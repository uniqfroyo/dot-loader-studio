import { Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Choice, Range, Toggle } from "@/components/editor-controls";
import type { Studio, StudioState } from "@/lib/studio-engine";
export default function StudioDialogs({
  s,
  api,
  help,
  setHelp,
}: {
  s: StudioState;
  api: Studio;
  help: boolean;
  setHelp: (value: boolean) => void;
}) {
  const action = (name: string) => api.action(name);
  const set = (key: string, value: number | boolean | string) =>
    api.set(key, value);
  return (
    <>
      <Dialog
        open={s.modal === "export"}
        onOpenChange={(open) => {
          if (!open) action("close");
        }}
      >
        <DialogPopup className="export-dialog" bottomStickOnMobile={false}>
          <DialogHeader>
            <DialogTitle>导出动画</DialogTitle>
            <DialogDescription>
              将当前动画用于产品，或保存项目以便继续编辑。
            </DialogDescription>
          </DialogHeader>
          <Tabs
            value={s.codeTab}
            onValueChange={(v) => api?.exportTab(String(v))}
          >
            <TabsList
              variant="underline"
              className="export-tabs"
              aria-label="导出格式"
            >
              {["react", "html", "gif", "npm", "braille", "json"].map(
                (v, i) => (
                  <TabsTab key={v} value={v}>
                    {["React", "HTML", "GIF", "npm", "终端", "项目"][i]}
                  </TabsTab>
                ),
              )}
            </TabsList>
            {["react", "html", "npm", "braille", "json"].map((v) => (
              <TabsPanel key={v} value={v}>
                <div className="export-body">
                  <p className="section-note">{s.codeMeta}</p>
                  {v === "braille" && (
                    <div className="braille-preview">
                      <pre id="braillePreview" />
                      <Range
                        label="点亮阈值"
                        value={Math.round(s.brailleThreshold * 100)}
                        min={5}
                        max={95}
                        unit="%"
                        onChange={(v) => set("brailleThreshold", v / 100)}
                      />
                    </div>
                  )}
                  <pre className="code-output" tabIndex={0}>
                    <code>{s.code}</code>
                  </pre>
                </div>
              </TabsPanel>
            ))}
            <TabsPanel value="gif">
              <div className="export-body">
                <div className="gif-preview">
                  {s.gifBusy ? (
                    <div className="gif-loading">
                      <span>正在生成 GIF…</span>
                      <progress value={s.gifProgress} max={1} />
                    </div>
                  ) : s.gifUrl ? (
                    <img src={s.gifUrl} alt="导出动画预览" />
                  ) : null}
                </div>
                <div className="gif-options">
                  <Field>
                    <FieldLabel>导出倍率</FieldLabel>
                    <Choice
                      label="GIF 导出倍率"
                      value={String(s.gifScale)}
                      onChange={(v) => set("gifScale", Number(v))}
                      options={["1", "2", "3", "4"].map((v) => [v, `${v}×`])}
                    />
                  </Field>
                  <Toggle
                    label="透明背景"
                    checked={s.gifTransparent}
                    onChange={(v) => set("gifTransparent", v)}
                  />
                </div>
                <p className="section-note">{s.gifMeta}</p>
              </div>
            </TabsPanel>
          </Tabs>
          <DialogFooter className="export-footer">
            <Button variant="ghost" onClick={() => action("close")}>
              取消
            </Button>
            {s.codeTab === "gif" ? (
              <Button
                disabled={s.gifBusy || !s.gifUrl}
                onClick={() => action("gif")}
              >
                <Download />
                下载 GIF
              </Button>
            ) : s.codeTab === "json" ? (
              <Button onClick={() => action("save")}>
                <Download />
                保存项目
              </Button>
            ) : (
              <>
                {["npm", "braille"].includes(s.codeTab) && (
                  <Button
                    variant="outline"
                    onClick={() => action("definition")}
                  >
                    下载 loader.json
                  </Button>
                )}
                <Button onClick={() => action("copy")}>
                  <Copy />
                  复制代码
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogPopup>
      </Dialog>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogPopup className="help-dialog" bottomStickOnMobile={false}>
          <DialogHeader>
            <DialogTitle>快捷键</DialogTitle>
            <DialogDescription>输入框中不会触发编辑快捷键。</DialogDescription>
          </DialogHeader>
          <dl className="shortcut-list">
            {[
              ["Space", "播放 / 暂停"],
              ["⌘Z / ⇧⌘Z", "撤销 / 重做"],
              ["← / →", "切换序列帧"],
              ["B / E / G", "画笔 / 橡皮 / 填充"],
              ["1 / 2 / 3", "画笔亮度"],
              ["N / D", "新建 / 复制帧"],
              ["O", "切换洋葱皮"],
            ].map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>
                  <kbd>{key}</kbd>
                </dd>
              </div>
            ))}
          </dl>
        </DialogPopup>
      </Dialog>
    </>
  );
}
