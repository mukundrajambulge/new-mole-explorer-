export const RIBBON_CATEGORIES = ["File", "Edit", "Select", "Display", "Color", "Measure", "Analyze", "Dock", "View", "Help"] as const;
export type RibbonCategory = (typeof RIBBON_CATEGORIES)[number];

export const MenuBar = ({ activeCategory, onCategory }: { activeCategory: RibbonCategory; onCategory: (category: RibbonCategory) => void }) => (
  <header className="menu-bar">
    <div className="menu-brand"><span className="brand-pulse" /> <span>WORKSTATION</span></div>
    <nav className="menu-links" aria-label="Application menu">
      {RIBBON_CATEGORIES.map((category) => (
        <button key={category} className={activeCategory === category ? "menu-link--active" : ""} onClick={() => onCategory(category)} aria-pressed={activeCategory === category} aria-expanded={activeCategory === category} data-ribbon-category={category} data-menu-active={activeCategory === category}>
          {category}
        </button>
      ))}
    </nav>
    <div className="menu-context"><span className="context-pill">G1C</span><span className="context-label">PRESENTATION</span></div>
  </header>
);
