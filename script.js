const SECTIONS = {
  species: {
    label: "Species",
    dataFile: "data/species.json",
  },
  careers: {
    label: "Careers",
    dataFile: "data/careers.json",
  },
  specializations: {
    label: "Specializations",
    dataFile: "data/specializations.json",
  },
  talents: {
    label: "Talents",
    dataFile: "data/talents.json",
  },
  gear: {
    label: "Gear",
    dataFile: "data/gear.json",
  },
  force_powers: {
    label: "Force Powers",
    dataFile: "data/force_powers.json",
  },
};

let currentSectionKey = "species";
let dataCache = {};          // { sectionKey: [items] }
let currentItems = [];
let activeItemId = null;

// Talent index for specialization trees
let talentIndex = {};

const navTabs = document.querySelectorAll(".nav-tab");
const searchInput = document.getElementById("searchInput");
const sourceFilter = document.getElementById("sourceFilter");
const subFilterContainer = document.getElementById("subFilterContainer");
const itemList = document.getElementById("itemList");

const detailPlaceholder = document.getElementById("detailPlaceholder");
const detailView = document.getElementById("detailView");
const detailName = document.getElementById("detailName");
const detailSubtitle = document.getElementById("detailSubtitle");
const detailSource = document.getElementById("detailSource");
const detailTags = document.getElementById("detailTags");
const detailSummary = document.getElementById("detailSummary");
const detailMechanics = document.getElementById("detailMechanics");
const detailNotes = document.getElementById("detailNotes");
const detailMetaGrid = document.getElementById("detailMetaGrid");

// Talent tree section
const detailTreeSection = document.getElementById("detailTreeSection");
const talentTreeContainer = document.getElementById("talentTree");

// -------- Data loading --------

async function loadSectionData(sectionKey) {
  if (dataCache[sectionKey]) return dataCache[sectionKey];

  const section = SECTIONS[sectionKey];
  if (!section) return [];

  try {
    const res = await fetch(section.dataFile);
    if (!res.ok) throw new Error("Failed to load " + section.dataFile);
    const data = await res.json();
    dataCache[sectionKey] = Array.isArray(data) ? data : [];
    return dataCache[sectionKey];
  } catch (err) {
    console.error("Error loading", sectionKey, err);
    dataCache[sectionKey] = [];
    return [];
  }
}

function normalize(str) {
  return (str || "").toString().toLowerCase();
}

// -------- Filters --------

function buildSourceFilter(items) {
  const sources = Array.from(
    new Set(
      items
        .map((i) => i.source && i.source.book)
        .filter(Boolean)
    )
  ).sort();

  sourceFilter.innerHTML = `<option value="">All sources</option>`;
  for (const book of sources) {
    const opt = document.createElement("option");
    opt.value = book;
    opt.textContent = book;
    sourceFilter.appendChild(opt);
  }
}

function buildSubFilter(items, sectionKey) {
  subFilterContainer.innerHTML = "";

  let labelText = "";
  let getField = null;

  if (sectionKey === "careers") {
    labelText = "Category";
    getField = (item) => item.category;
  } else if (sectionKey === "specializations") {
    labelText = "Career";
    getField = (item) => item.career;
  } else if (sectionKey === "talents") {
    labelText = "Tier";
    getField = (item) => item.tier;
  } else if (sectionKey === "gear") {
    labelText = "Gear Type";
    getField = (item) => item.type;
  } else if (sectionKey === "force_powers") {
    labelText = "Power Type";
    getField = (item) => item.powerType;
  }

  if (!getField) return;

  const values = Array.from(
    new Set(items.map(getField).filter(Boolean))
  ).sort();
  if (!values.length) return;

  const wrapper = document.createElement("div");
  wrapper.className = "filter-group";

  const label = document.createElement("label");
  label.textContent = labelText;
  wrapper.appendChild(label);

  const select = document.createElement("select");
  select.id = "subFilterSelect";
  select.innerHTML = `<option value="">All</option>`;
  values.forEach((val) => {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = val;
    select.appendChild(opt);
  });

  select.addEventListener("change", applyFilters);

  wrapper.appendChild(select);
  subFilterContainer.appendChild(wrapper);
}

function applyFilters() {
  const q = normalize(searchInput.value);
  const sourceValue = sourceFilter.value;
  const subSelect = document.getElementById("subFilterSelect");
  const subValue = subSelect ? subSelect.value : "";

  const filtered = currentItems.filter((item) => {
    const haystack =
      `${item.name || ""} ${item.subtitle || ""} ${(item.tags || []).join(" ")} ${item.type || ""} ${
        item.category || ""
      } ${(item.keywords || []).join(" ")} ${item.traits || ""} ${
        (item.source && item.source.book) || ""
      }`;

    if (q && !normalize(haystack).includes(q)) return false;

    if (sourceValue && (!item.source || item.source.book !== sourceValue)) return false;

    if (subValue) {
      let field = null;
      if (currentSectionKey === "careers") field = item.category;
      else if (currentSectionKey === "specializations") field = item.career;
      else if (currentSectionKey === "talents") field = item.tier;
      else if (currentSectionKey === "gear") field = item.type;
      else if (currentSectionKey === "force_powers") field = item.powerType;

      if (!field || field !== subValue) return false;
    }

    return true;
  });

  renderList(filtered);
}

// -------- List rendering --------

function renderList(items) {
  itemList.innerHTML = "";

  if (!items.length) {
    const li = document.createElement("li");
    li.textContent = "No entries yet. Add data to the JSON file for this section.";
    li.style.padding = "0.6rem 0.5rem";
    li.style.fontSize = "0.85rem";
    li.style.color = "#9ca3af";
    itemList.appendChild(li);
    return;
  }

  for (const item of items) {
    const li = document.createElement("li");
    li.className = "item-row";
    li.dataset.id = item.id;

    if (item.id === activeItemId) {
      li.classList.add("active");
    }

    const nameEl = document.createElement("div");
    nameEl.className = "item-name";
    nameEl.textContent = item.name || "Untitled";

    const subtitleEl = document.createElement("div");
    subtitleEl.className = "item-subtitle";
    subtitleEl.textContent =
      item.subtitle ||
      item.type ||
      item.category ||
      (item.career && `For ${item.career}`) ||
      "";

    const metaRow = document.createElement("div");
    metaRow.className = "item-meta";

    if (item.source && item.source.book) {
      const bad = document.createElement("span");
      bad.className = "badge badge-source";
      bad.textContent = item.source.book;
      metaRow.appendChild(bad);
    }

    if (Array.isArray(item.tags)) {
      item.tags.slice(0, 3).forEach((tag) => {
        const bad = document.createElement("span");
        bad.className = "badge";
        bad.textContent = tag;
        metaRow.appendChild(bad);
      });
    }

    li.appendChild(nameEl);
    if (subtitleEl.textContent) li.appendChild(subtitleEl);
    if (metaRow.childNodes.length) li.appendChild(metaRow);

    li.addEventListener("click", () => {
      activeItemId = item.id;
      document
        .querySelectorAll(".item-row.active")
        .forEach((el) => el.classList.remove("active"));
      li.classList.add("active");
      showDetail(item);
    });

    itemList.appendChild(li);
  }
}

// -------- Talent tree rendering --------

function renderTalentTree(item) {
  if (!detailTreeSection || !talentTreeContainer) return;

  // Only show tree for specializations that define a talentGrid
  const grid =
    currentSectionKey === "specializations" && Array.isArray(item.talentGrid)
      ? item.talentGrid
      : null;

  if (!grid || !grid.length) {
    detailTreeSection.classList.add("hidden");
    talentTreeContainer.innerHTML = "";
    return;
  }

  detailTreeSection.classList.remove("hidden");
  talentTreeContainer.innerHTML = "";

  const cols = grid[0] ? grid[0].length : 4;
  talentTreeContainer.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;

  grid.forEach((row) => {
    row.forEach((cellId) => {
      const node = document.createElement("div");

      if (!cellId) {
        node.className = "talent-node talent-node-empty";
        talentTreeContainer.appendChild(node);
        return;
      }

      node.className = "talent-node";

      const talent = talentIndex[cellId];

      const nameEl = document.createElement("div");
      nameEl.className = "talent-node-name";
      nameEl.textContent = talent?.name || cellId;

      const tier = talent?.meta?.Tier ?? talent?.tier;
      const tierEl = document.createElement("div");
      tierEl.className = "talent-node-tier";
      tierEl.textContent = tier ? `Tier ${tier}` : "";

      node.appendChild(nameEl);
      if (tierEl.textContent) node.appendChild(tierEl);

      if (talent && talent.mechanics && talent.mechanics.text) {
        node.title = talent.mechanics.text;
      }

      talentTreeContainer.appendChild(node);
    });
  });
}

// -------- Detail rendering --------

function showDetail(item) {
  detailPlaceholder.classList.add("hidden");
  detailView.classList.remove("hidden");

  detailName.textContent = item.name || "Untitled";
  detailSubtitle.textContent =
    item.subtitle ||
    item.type ||
    item.category ||
    (item.career && `For ${item.career}`) ||
    "";
  detailSubtitle.classList.toggle("hidden", !detailSubtitle.textContent);

  if (item.source && item.source.book) {
    const pagePart = item.source.page ? `, p. ${item.source.page}` : "";
    detailSource.textContent = `${item.source.book}${pagePart}`;
  } else {
    detailSource.textContent = "";
  }

  // Tags
  detailTags.innerHTML = "";
  if (Array.isArray(item.tags)) {
    item.tags.forEach((tag) => {
      const span = document.createElement("span");
      span.className = "badge";
      span.textContent = tag;
      detailTags.appendChild(span);
    });
  }

  // Summary
  detailSummary.textContent = item.summary || "";
  document
    .getElementById("detailSummarySection")
    .classList.toggle("hidden", !item.summary);

  // Talent tree (specializations only)
  renderTalentTree(item);

  // Mechanics
  detailMechanics.innerHTML = "";
  const mech = item.mechanics || {};
  const hasBlocks = Array.isArray(mech.blocks) && mech.blocks.length > 0;
  const hasText = !!mech.text;

  if (hasBlocks) {
    mech.blocks.forEach((block) => {
      const div = document.createElement("div");
      if (block.label) {
        const strong = document.createElement("strong");
        strong.textContent = block.label + ": ";
        div.appendChild(strong);
      }
      const span = document.createElement("span");
      span.textContent = block.text || "";
      div.appendChild(span);
      detailMechanics.appendChild(div);
    });
  } else if (hasText) {
    const div = document.createElement("div");
    div.textContent = mech.text;
    detailMechanics.appendChild(div);
  }

  document
    .getElementById("detailMechanicsSection")
    .classList.toggle("hidden", !hasBlocks && !hasText);

  // Notes
  detailNotes.textContent = item.notes || "";
  document
    .getElementById("detailNotesSection")
    .classList.toggle("hidden", !item.notes);

  // Meta
  detailMetaGrid.innerHTML = "";
  const meta = item.meta || {};
  Object.entries(meta).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    const dt = document.createElement("dt");
    dt.textContent = key;
    const dd = document.createElement("dd");
    dd.textContent = value;
    detailMetaGrid.appendChild(dt);
    detailMetaGrid.appendChild(dd);
  });
  document
    .getElementById("detailMetaSection")
    .classList.toggle("hidden", !detailMetaGrid.childNodes.length);
}

// -------- Tab switching --------

async function handleTabClick(sectionKey) {
  if (sectionKey === currentSectionKey) return;

  currentSectionKey = sectionKey;
  activeItemId = null;
  detailView.classList.add("hidden");
  detailPlaceholder.classList.remove("hidden");

  navTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.section === sectionKey);
  });

  searchInput.value = "";
  sourceFilter.value = "";
  subFilterContainer.innerHTML = "";

  const items = await loadSectionData(sectionKey);
  currentItems = items;
  buildSourceFilter(items);
  buildSubFilter(items, sectionKey);
  applyFilters();
}

// -------- Event listeners --------

navTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const section = tab.dataset.section;
    handleTabClick(section);
  });
});

searchInput.addEventListener("input", () => {
  applyFilters();
});

sourceFilter.addEventListener("change", () => {
  applyFilters();
});

// -------- Init --------

(async function init() {
  // Preload talents to build the index for specialization talent trees
  const talents = await loadSectionData("talents");
  talentIndex = {};
  talents.forEach((t) => {
    if (t.id) talentIndex[t.id] = t;
  });

  const items = await loadSectionData(currentSectionKey);
  currentItems = items;
  buildSourceFilter(items);
  buildSubFilter(items, currentSectionKey);
  applyFilters();
})();
