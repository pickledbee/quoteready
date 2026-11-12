/*
 * QuoteReady industry templates (shared file)
 * ------------------------------------------------------------
 * Each template uses the SAME rows the Google Sheet uses, so loading a
 * template into a Sheet and showing it in the demo are the same data.
 * All businesses, phone numbers (555-01xx) and prices are SAMPLES.
 * Every owner must replace the prices with their own.
 * Run `node tools/sync.js` after editing so Apps Script gets the same copy.
 *
 * services rows:    ID | Name | Description | Base price | Measure | Price per unit | Min | Max | Step | Default | Minimum charge | Recurring | Active
 * options rows:     Service ID (or ALL) | Question | Answer | Price change | Type (Add $ / Add % / $ per unit)
 * addons rows:      Service ID (or ALL) | Extra | Price | Type (Flat / Per unit)
 * frequencies rows: Frequency | Discount %
 */
var QRTemplates = (function () {
  'use strict';
  return {
    'house-cleaning': {
      label: 'House cleaning',
      business: { name: 'Sparkle Lane Cleaning', brandColor: '#2a7de1', phone: '(555) 010-0101', headline: 'Get your cleaning price in 60 seconds', intro: 'Tell us about your home and see your price right away. No phone tag.' },
      services: [
        ['standard', 'Standard cleaning', 'Kitchen, bathrooms, dusting, floors and the rooms you live in.', 40, 'square feet', 0.08, 500, 6000, 100, 1800, 120, 'Yes', 'Yes'],
        ['deep', 'Deep cleaning', 'Everything in a standard clean plus baseboards, doors, vents and built-up grime.', 60, 'square feet', 0.14, 500, 6000, 100, 1800, 220, 'No', 'Yes'],
        ['move-out', 'Move-in / move-out cleaning', 'Empty-home top-to-bottom clean, inside cabinets included.', 80, 'square feet', 0.16, 500, 6000, 100, 1500, 260, 'No', 'Yes']
      ],
      options: [
        ['ALL', 'Bedrooms', '1', 0, 'Add $'], ['ALL', 'Bedrooms', '2', 15, 'Add $'], ['ALL', 'Bedrooms', '3', 30, 'Add $'], ['ALL', 'Bedrooms', '4', 45, 'Add $'], ['ALL', 'Bedrooms', '5 or more', 65, 'Add $'],
        ['ALL', 'Bathrooms', '1', 0, 'Add $'], ['ALL', 'Bathrooms', '2', 20, 'Add $'], ['ALL', 'Bathrooms', '3', 40, 'Add $'], ['ALL', 'Bathrooms', '4 or more', 60, 'Add $'],
        ['ALL', 'Pets in the home?', 'No pets', 0, 'Add %'], ['ALL', 'Pets in the home?', 'Yes, pets', 10, 'Add %']
      ],
      addons: [
        ['ALL', 'Inside the oven', 35, 'Flat'], ['ALL', 'Inside the fridge', 35, 'Flat'], ['ALL', 'Inside windows', 45, 'Flat'], ['standard', 'Laundry (wash and fold one load)', 25, 'Flat']
      ],
      frequencies: [['One time', 0], ['Every week', 20], ['Every 2 weeks', 15], ['Every 4 weeks', 10]]
    },

    'lawn-care': {
      label: 'Lawn care and landscaping',
      business: { name: 'GreenEdge Lawn Care', brandColor: '#2f8f46', phone: '(555) 010-0102', headline: 'See your lawn care price now', intro: 'Pick a service, tell us your yard size, and get a price before you even pick up the phone.' },
      services: [
        ['mowing', 'Lawn mowing', 'Mow, trim and blow off walks and drives.', 20, 'thousand sq ft of lawn', 4, 1, 60, 1, 8, 40, 'Yes', 'Yes'],
        ['spring-cleanup', 'Spring or fall cleanup', 'Leaves, sticks and beds cleaned up and hauled away.', 75, 'thousand sq ft of lawn', 6, 1, 60, 1, 8, 150, 'No', 'Yes'],
        ['aeration', 'Core aeration', 'Loosens packed soil so water and roots get deeper.', 40, 'thousand sq ft of lawn', 3.5, 1, 60, 1, 8, 90, 'No', 'Yes']
      ],
      options: [
        ['mowing', 'How tall is the grass right now?', 'Normal', 0, 'Add %'], ['mowing', 'How tall is the grass right now?', 'Tall (over 6 inches)', 15, 'Add %'], ['mowing', 'How tall is the grass right now?', 'Very overgrown', 35, 'Add %'],
        ['ALL', 'Is the backyard fenced with a gate?', 'No fence', 0, 'Add $'], ['ALL', 'Is the backyard fenced with a gate?', 'Yes, gated', 5, 'Add $']
      ],
      addons: [
        ['mowing', 'Edging along walks and beds', 15, 'Flat'], ['mowing', 'Bag and haul clippings', 20, 'Flat'], ['ALL', 'Weed spot treatment', 25, 'Flat'], ['aeration', 'Overseeding', 2.5, 'Per unit']
      ],
      frequencies: [['One time', 0], ['Every week', 10], ['Every 2 weeks', 5]]
    },

    'pressure-washing': {
      label: 'Pressure washing',
      business: { name: 'Bright Bay Pressure Washing', brandColor: '#0e7490', phone: '(555) 010-0103', headline: 'Instant pressure washing quote', intro: 'Driveways, houses and decks. Enter the size and see your price right now.' },
      services: [
        ['concrete', 'Driveway and concrete', 'Driveways, sidewalks, patios and garage floors.', 50, 'square feet', 0.18, 200, 5000, 50, 800, 150, 'No', 'Yes'],
        ['house-wash', 'House soft wash', 'Low-pressure wash that is safe for siding and kills mildew.', 99, 'square feet of home', 0.10, 800, 6000, 100, 2000, 249, 'No', 'Yes'],
        ['deck', 'Deck or fence', 'Wood or composite cleaning and brightening.', 60, 'square feet', 0.45, 100, 2000, 25, 300, 175, 'No', 'Yes']
      ],
      options: [
        ['house-wash', 'How many stories?', '1 story', 0, 'Add %'], ['house-wash', 'How many stories?', '2 stories', 15, 'Add %'], ['house-wash', 'How many stories?', '3 stories', 30, 'Add %'],
        ['concrete', 'How stained is it?', 'Normal dirt', 0, 'Add %'], ['concrete', 'How stained is it?', 'Heavy oil or rust stains', 20, 'Add %']
      ],
      addons: [
        ['concrete', 'Concrete sealing', 0.25, 'Per unit'], ['house-wash', 'Gutter face brightening', 75, 'Flat'], ['deck', 'Deck stain or seal', 0.75, 'Per unit']
      ],
      frequencies: []
    },

    'interior-painting': {
      label: 'Interior painting',
      business: { name: 'Fresh Coat Painters', brandColor: '#b45309', phone: '(555) 010-0104', headline: 'Painting price in under a minute', intro: 'Tell us how many rooms and what you need. We will show your estimate instantly.' },
      services: [
        ['rooms', 'Room painting', 'Two coats on walls, prep, cover and clean up included.', 0, 'rooms', 375, 1, 20, 1, 2, 400, 'No', 'Yes'],
        ['cabinets', 'Cabinet painting', 'Clean, sand, prime and spray cabinet doors and boxes.', 0, 'doors and drawers', 95, 10, 80, 1, 24, 1500, 'No', 'Yes']
      ],
      options: [
        ['rooms', 'Paint ceilings too?', 'Walls only', 0, 'Add %'], ['rooms', 'Paint ceilings too?', 'Walls and ceilings', 25, 'Add %'],
        ['rooms', 'Ceiling height', 'Standard (8 to 9 ft)', 0, 'Add %'], ['rooms', 'Ceiling height', 'Tall or vaulted', 20, 'Add %'],
        ['rooms', 'Wall condition', 'Good shape', 0, '$ per unit'], ['rooms', 'Wall condition', 'Needs patching', 60, '$ per unit']
      ],
      addons: [
        ['rooms', 'Trim and baseboards', 85, 'Per unit'], ['rooms', 'Dark to light color change', 60, 'Per unit'], ['ALL', 'We move the furniture', 75, 'Flat']
      ],
      frequencies: []
    },

    'window-cleaning': {
      label: 'Window cleaning',
      business: { name: 'ClearView Window Co.', brandColor: '#4f46e5', phone: '(555) 010-0105', headline: 'Window cleaning price, instantly', intro: 'Count your windows, pick inside or outside, and see your price.' },
      services: [
        ['windows', 'Window cleaning', 'Hand-washed glass, wiped frames and sills.', 0, 'windows', 9, 5, 150, 1, 20, 120, 'Yes', 'Yes']
      ],
      options: [
        ['windows', 'Inside, outside, or both?', 'Outside only', 0, 'Add %'], ['windows', 'Inside, outside, or both?', 'Inside and outside', 70, 'Add %'],
        ['windows', 'How many stories?', '1 story', 0, 'Add %'], ['windows', 'How many stories?', '2 stories', 15, 'Add %'], ['windows', 'How many stories?', '3 or more', 35, 'Add %']
      ],
      addons: [
        ['windows', 'Screen cleaning', 2, 'Per unit'], ['windows', 'Track cleaning', 3, 'Per unit'], ['windows', 'Hard water spot removal', 75, 'Flat']
      ],
      frequencies: [['One time', 0], ['Every 3 months', 10], ['Twice a year', 5]]
    },

    'junk-removal': {
      label: 'Junk removal',
      business: { name: 'Haul Pals Junk Removal', brandColor: '#dc2626', phone: '(555) 010-0106', headline: 'What will it cost to haul it away?', intro: 'Pick how much stuff you have and where it is. Get a price now, book a pickup today.' },
      services: [
        ['load', 'Junk removal by truck load', 'We load it, haul it, and donate or recycle what we can.', 0, '', 0, 0, 0, 1, 0, 99, 'No', 'Yes'],
        ['single-item', 'Single item pickup', 'One couch, one fridge, one hot tub cover. Quick and simple.', 64, 'items', 25, 1, 5, 1, 1, 89, 'No', 'Yes']
      ],
      options: [
        ['load', 'How much stuff?', 'A few items (minimum load)', 99, 'Add $'], ['load', 'How much stuff?', 'About 1/4 truck', 199, 'Add $'], ['load', 'How much stuff?', 'About 1/2 truck', 329, 'Add $'], ['load', 'How much stuff?', 'About 3/4 truck', 449, 'Add $'], ['load', 'How much stuff?', 'Full truck', 569, 'Add $'],
        ['ALL', 'Where is it?', 'Curbside or garage', 0, 'Add $'], ['ALL', 'Where is it?', 'Inside the home, ground floor', 40, 'Add $'], ['ALL', 'Where is it?', 'Upstairs or basement', 75, 'Add $']
      ],
      addons: [
        ['ALL', 'Mattress or box spring disposal', 40, 'Flat'], ['ALL', 'Appliance with freon', 50, 'Flat'], ['ALL', 'Same-day pickup', 75, 'Flat']
      ],
      frequencies: []
    }
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = QRTemplates;
