import type { Snapshot } from "@ai-tech-stack/shared";
import { CategoryCell } from "./CategoryCell";

export function StackMap({ snapshot }: { snapshot: Snapshot }) {
  const layers = [...snapshot.layers].sort((a, b) => a.order - b.order);

  return (
    <section className="stack" aria-label="AI 技术栈分层地图">
      {layers.map((layer, index) => {
        const cats = snapshot.categories.filter((c) => c.layerId === layer.id);
        const idx = String(index + 1).padStart(2, "0");
        return (
          <article key={layer.id} className="layer">
            <div className="layer-head">
              <div className="layer-title-wrap">
                <span className="layer-index">{idx}</span>
                <h2 className="layer-title">{layer.name}</h2>
              </div>
              <span className="layer-en">{layer.nameEn}</span>
            </div>
            <div className="layer-grid">
              {cats.map((cat) => (
                <CategoryCell key={cat.id} category={cat} />
              ))}
            </div>
          </article>
        );
      })}
    </section>
  );
}
