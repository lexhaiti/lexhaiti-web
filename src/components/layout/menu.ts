export type MenuLink = {
  labelKey: string
  href: string
  descriptionKey?: string
  tagKey?: string
}

export type MenuColumn = {
  titleKey: string
  descriptionKey?: string
  items: MenuLink[]
}

export type MenuItem = {
  labelKey: string
  href?: string
  type: 'link' | 'megamenu'
  descriptionKey?: string
  columns?: MenuColumn[]
}

export const MENU_DATA: MenuItem[] = [
  { labelKey: 'menu.top.home', href: '/', type: 'link' },

  {
    labelKey: 'menu.top.constitution',
    href: '/lois?category=constitution',
    type: 'megamenu',
    descriptionKey: 'menu.descriptions.constitution',
    columns: [
      {
        titleKey: 'menu.constitution.col1Title', // CONSTITUTION ACTUELLE
        descriptionKey: 'menu.constitution.col1Desc',
        items: [
          {
            labelKey: 'menu.constitution.amended1987',
            descriptionKey: 'menu.constitution.amended1987Desc',
            href: '/loi/constitution-1987',
            tagKey: 'menu.tags.current',
          },
          {
            labelKey: 'menu.constitution.amendments',
            descriptionKey: 'menu.constitution.amendmentsDesc',
            // Dedicated amendments page on the currently-in-force
            // Constitution. Lists every article with > 1 version +
            // their full timeline. See
            // /api/v1/legal-texts/{slug}/amendments.
            href: '/loi/constitution-1987/amendements',
          },
        ],
      },
      {
        titleKey: 'menu.constitution.col2Title', // DOCUMENTS HISTORIQUES
        descriptionKey: 'menu.constitution.col2Desc',
        items: [
          {
            labelKey: 'menu.constitution.c1811',
            descriptionKey: 'menu.constitution.c1811Desc',
            href: '/loi/constitution-royale-de-1811-christophe',
          },
          {
            labelKey: 'menu.constitution.c1849',
            descriptionKey: 'menu.constitution.c1849Desc',
            href: '/loi/constitution-imperiale-de-1849-soulouque-faustin-ier',
          },
          {
            labelKey: 'menu.constitution.c1964',
            descriptionKey: 'menu.constitution.c1964Desc',
            // 1964 Constitution not yet in the corpus — fall back to
            // a search; promote to /loi/<slug> once the record exists.
            href: '/lois?category=constitution&q=1964',
          },
        ],
      },
      {
        titleKey: 'menu.constitution.col3Title', // ACTES FONDATEURS
        descriptionKey: 'menu.constitution.col3Desc',
        items: [
          {
            labelKey: 'menu.constitution.acteIndependance',
            descriptionKey: 'menu.constitution.acteIndependanceDesc',
            href: '/loi/acte-de-l-independance-1804',
          },
          {
            labelKey: 'menu.constitution.proclamationDessalines',
            descriptionKey: 'menu.constitution.proclamationDessalinesDesc',
            href: '/loi/proclamation-des-generaux-a-dessalines-1804',
          },
          {
            labelKey: 'menu.constitution.discoursDessalines',
            descriptionKey: 'menu.constitution.discoursDessalinesDesc',
            href: '/loi/discours-de-dessalines-au-peuple-d-hayti-1804',
          },
          {
            labelKey: 'menu.constitution.c1805',
            descriptionKey: 'menu.constitution.c1805Desc',
            href: '/loi/constitution-imperiale-d-haiti-de-1805-dessalines',
          },
        ],
      },
    ],
  },

  {
    labelKey: 'menu.top.codesAndLaws',
    href: '/lois',
    type: 'megamenu',
    descriptionKey: 'menu.descriptions.codesAndLaws',
    columns: [
      {
        titleKey: 'menu.codes.col1Title',
        descriptionKey: 'menu.codes.col1Desc',
        items: [
          // Each code links to the precise category + code_subcategory
          // filter — backend `CodeSubcategory` enum matches the URL value.
          // The /lois page picks up the dropdown automatically.
          {
            labelKey: 'menu.codes.civil',
            descriptionKey: 'menu.codes.civilDesc',
            href: '/lois?category=code&code_subcategory=code_civil',
            tagKey: 'menu.tags.updated2023',
          },
          {
            labelKey: 'menu.codes.penal',
            descriptionKey: 'menu.codes.penalDesc',
            href: '/lois?category=code&code_subcategory=code_penal',
          },
          {
            labelKey: 'menu.codes.commerce',
            descriptionKey: 'menu.codes.commerceDesc',
            href: '/lois?category=code&code_subcategory=code_commerce',
          },
          {
            labelKey: 'menu.codes.labour',
            descriptionKey: 'menu.codes.labourDesc',
            href: '/lois?category=code&code_subcategory=code_travail',
          },
          {
            labelKey: 'menu.codes.rural',
            descriptionKey: 'menu.codes.ruralDesc',
            href: '/lois?category=code&code_subcategory=code_rural',
          },
        ],
      },
      {
        titleKey: 'menu.codes.col2Title',
        descriptionKey: 'menu.codes.col2Desc',
        items: [
          {
            labelKey: 'menu.codes.lois',
            descriptionKey: 'menu.codes.loisDesc',
            href: '/lois?category=loi',
            tagKey: 'menu.tags.new',
          },
          {
            labelKey: 'menu.codes.decrets',
            descriptionKey: 'menu.codes.decretsDesc',
            href: '/lois?category=decret',
          },
          {
            labelKey: 'menu.codes.arretes',
            descriptionKey: 'menu.codes.arretesDesc',
            href: '/lois?category=arrete',
          },
          {
            labelKey: 'menu.codes.traites',
            descriptionKey: 'menu.codes.traitesDesc',
            href: '/lois?category=convention',
          },
        ],
      },
      {
        titleKey: 'menu.codes.col3Title',
        descriptionKey: 'menu.codes.col3Desc',
        items: [
          // These advanced views aren't built as dedicated pages yet — each
          // routes to a filtered /lois listing that approximates the intent.
          {
            labelKey: 'menu.codes.searchByTheme',
            descriptionKey: 'menu.codes.searchByThemeDesc',
            href: '/recherche/avancee',
          },
          {
            labelKey: 'menu.codes.recent',
            descriptionKey: 'menu.codes.recentDesc',
            href: '/lois?sort=recently_updated',
          },
          {
            labelKey: 'menu.codes.abroges',
            descriptionKey: 'menu.codes.abrogesDesc',
            href: '/lois?status=abrogated',
          },
          {
            labelKey: 'menu.codes.indexAZ',
            descriptionKey: 'menu.codes.indexAZDesc',
            href: '/lois?sort=alphabetical',
          },
        ],
      },
    ],
  },

  { labelKey: 'menu.top.moniteur', href: '/moniteur', type: 'link' },

  {
    labelKey: 'menu.top.themes',
    href: '/thematiques',
    type: 'megamenu',
    descriptionKey: 'menu.descriptions.themes',
    columns: [
      {
        titleKey: 'menu.themes.col1Title',
        descriptionKey: 'menu.themes.col1Desc',
        items: [
          // Each item maps to a backend `LegalTheme` enum value via
          // ?theme=<key> — see backend/services/corpus/themes.py.
          {
            labelKey: 'menu.themes.societes',
            descriptionKey: 'menu.themes.societesDesc',
            href: '/lois?theme=droit_societes',
          },
          {
            labelKey: 'menu.themes.fiscal',
            descriptionKey: 'menu.themes.fiscalDesc',
            href: '/lois?theme=droit_fiscal',
          },
          {
            labelKey: 'menu.themes.bancaire',
            descriptionKey: 'menu.themes.bancaireDesc',
            href: '/lois?theme=droit_bancaire',
          },
          {
            labelKey: 'menu.themes.pi',
            descriptionKey: 'menu.themes.piDesc',
            href: '/lois?theme=propriete_intellectuelle',
          },
        ],
      },
      {
        titleKey: 'menu.themes.col2Title',
        descriptionKey: 'menu.themes.col2Desc',
        items: [
          {
            labelKey: 'menu.themes.travail',
            descriptionKey: 'menu.themes.travailDesc',
            href: '/lois?theme=droit_travail',
          },
          {
            labelKey: 'menu.themes.protection',
            descriptionKey: 'menu.themes.protectionDesc',
            href: '/lois?theme=protection_sociale',
          },
          {
            labelKey: 'menu.themes.famille',
            descriptionKey: 'menu.themes.familleDesc',
            href: '/lois?theme=droit_famille',
          },
          {
            labelKey: 'menu.themes.successions',
            descriptionKey: 'menu.themes.successionsDesc',
            href: '/lois?theme=successions',
          },
        ],
      },
      {
        titleKey: 'menu.themes.col3Title',
        descriptionKey: 'menu.themes.col3Desc',
        items: [
          {
            labelKey: 'menu.themes.administratif',
            descriptionKey: 'menu.themes.administratifDesc',
            href: '/lois?theme=droit_administratif',
          },
          {
            labelKey: 'menu.themes.marches',
            descriptionKey: 'menu.themes.marchesDesc',
            href: '/lois?theme=marches_publics',
          },
          {
            labelKey: 'menu.themes.environnement',
            descriptionKey: 'menu.themes.environnementDesc',
            href: '/lois?theme=environnement',
          },
          {
            labelKey: 'menu.themes.foncier',
            descriptionKey: 'menu.themes.foncierDesc',
            href: '/lois?theme=foncier',
          },
        ],
      },
    ],
  },
  { labelKey: 'menu.top.about', href: '/a-propos', type: 'link' },
]
