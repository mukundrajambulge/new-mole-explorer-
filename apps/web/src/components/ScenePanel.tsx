import type { SceneCollection } from "@molecular/contracts";

type ScenePanelProps = {
  collection: SceneCollection;
  onStore: (name: string) => { ok: boolean; message?: string };
  onRecall: (sceneId: string) => { ok: boolean; message?: string };
  onUpdate: (sceneId: string) => { ok: boolean; message?: string };
  onRename: (sceneId: string, name: string) => { ok: boolean; message?: string };
  onDelete: (sceneId: string) => { ok: boolean; message?: string };
  onStep: (direction: -1 | 1) => { ok: boolean; message?: string };
};

export const ScenePanel = ({ collection, onStore, onRecall, onUpdate, onRename, onDelete, onStep }: ScenePanelProps) => {
  const run = (operation: () => { ok: boolean; message?: string }) => {
    const result = operation();
    if (!result.ok && result.message) window.alert(result.message);
  };
  return <section className="scene-manager" aria-label="Scene manager" data-testid="scene-manager">
    <div className="scene-manager__heading"><div><h2>Scenes</h2></div><div className="scene-manager__actions"><button type="button" onClick={() => run(() => onStep(-1))} aria-label="Previous scene">Previous</button><button type="button" onClick={() => run(() => onStep(1))} aria-label="Next scene">Next</button></div></div>
    <div className="scene-manager__store"><input aria-label="Scene name" placeholder="Scene name" data-testid="scene-name" onKeyDown={(event) => { if (event.key === "Enter") { const input = event.currentTarget; run(() => onStore(input.value)); if (input.value) input.value = ""; } }} /><button type="button" onClick={(event) => { const input = event.currentTarget.parentElement?.querySelector("input"); if (input?.value) { run(() => onStore(input.value)); input.value = ""; } }} data-testid="scene-store">Store</button></div>
    {collection.scenes.length === 0 ? <p className="scene-manager__empty">No scenes stored. Store a renderer-neutral view checkpoint.</p> : <div className="scene-manager__list">{collection.scenes.map((scene) => <article className={`scene-card ${scene.sceneId === collection.currentSceneId ? "scene-card--current" : ""}`} key={scene.sceneId} data-testid="scene-card" data-scene-id={scene.sceneId}><div><strong>{scene.name}</strong><small>v{scene.sceneRevision} · {scene.objectRefs.length} object{scene.objectRefs.length === 1 ? "" : "s"}</small></div><div className="scene-card__actions"><button type="button" onClick={() => run(() => onRecall(scene.sceneId))}>Recall</button><button type="button" onClick={() => run(() => onUpdate(scene.sceneId))}>Update</button><button type="button" onClick={() => { const name = window.prompt("New scene name", scene.name); if (name) run(() => onRename(scene.sceneId, name)); }}>Rename</button><button type="button" onClick={() => run(() => onDelete(scene.sceneId))}>Delete</button></div></article>)}</div>}
  </section>;
};
