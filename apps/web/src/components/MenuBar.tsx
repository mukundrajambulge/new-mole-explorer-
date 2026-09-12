/** The application menu exposes scientific work, not implementation gates. */
export const RIBBON_CATEGORIES = ["File", "Select", "Display", "Color", "Measure", "Analyze", "View", "Help"] as const;
export type RibbonCategory = (typeof RIBBON_CATEGORIES)[number];

export const MenuBar = ({ activeCategory, onCategory }: { activeCategory: RibbonCategory; onCategory: (category: RibbonCategory) => void }) => (
  <header className="menu-bar">
    <div className="menu-brand"><span className="brand-pulse" /> <span>MOLEXPLORER</span></div>
    <nav className="menu-links" aria-label="Application menu">
      {RIBBON_CATEGORIES.map((category) => (
        <button key={category} className={activeCategory === category ? "menu-link--active" : ""} onClick={() => onCategory(category)} aria-pressed={activeCategory === category} aria-expanded={activeCategory === category} data-ribbon-category={category} data-menu-active={activeCategory === category}>
          {category}
        </button>
      ))}
    </nav>
    <div className="menu-context"><span className="context-label">Scientific workspace</span></div>
  </header>
);
