export const registryConfig = Object.freeze({
  supabaseUrl: 'https://pszrshbwqxeefhoxfkyk.supabase.co',
  supabasePublishableKey: 'sb_publishable_DemlV9A14gxg2KUOqNK0Hg_G8A1jo1-',
  createCheckoutUrl: 'https://pszrshbwqxeefhoxfkyk.supabase.co/functions/v1/create-checkout',
  turnstileSiteKey: '0x4AAAAAAFANakvImpaOLTQg',
  siteUrl: 'https://levyponciano08.github.io/casamento-levy-lais',
  demoMode: false
});

export const demoGifts = Object.freeze([
  {
    id: 'demo-1',
    title: 'Jantar especial para os noivos',
    description: 'Uma noite para celebrar o começo da nossa vida a dois.',
    category: 'Experiências',
    gift_mode: 'unit',
    price_cents: 28000,
    quantity_total: 1,
    available_quantity: 1,
    remaining_amount_cents: 28000,
    image_url: ''
  },
  {
    id: 'demo-2',
    title: 'Lua de mel',
    description: 'Uma contribuição para construirmos memórias inesquecíveis.',
    category: 'Lua de mel',
    gift_mode: 'quota',
    price_cents: 300000,
    minimum_contribution_cents: 5000,
    quantity_total: 1,
    available_quantity: 1,
    remaining_amount_cents: 300000,
    image_url: ''
  },
  {
    id: 'demo-3',
    title: 'Café da manhã de domingo',
    description: 'Para os primeiros domingos tranquilos na nossa casa.',
    category: 'Casa nova',
    gift_mode: 'unit',
    price_cents: 16000,
    quantity_total: 2,
    available_quantity: 2,
    remaining_amount_cents: 32000,
    image_url: ''
  }
]);
