// Words and links for the public site: the menus, the footer and the
// information pages. Kept here, apart from the components, so wording can be
// changed in one place.
//
// Paws Shelter is a class project (CSE 5324). The address and phone number
// below are made up; 555 numbers are reserved for fiction.

export const SHELTER = {
  name: 'Paws Shelter',
  tagline: 'Every animal deserves a home',
  street: '123 Shelter Lane',
  city: 'Arlington, TX 76019',
  phone: '(817) 555-0142',
  phoneHref: 'tel:+18175550142',
  email: 'hello@pawsshelter.example',
  hours: [
    ['Tuesday – Friday', '11 am – 7 pm'],
    ['Saturday – Sunday', '10 am – 5 pm'],
    ['Monday', 'Closed'],
  ],
  // The same hours for the "Open now" badge: day (0 = Sunday) -> [open, close]
  // in 24-hour clock hours, or null when closed.
  schedule: { 0: [10, 17], 1: null, 2: [11, 19], 3: [11, 19], 4: [11, 19], 5: [11, 19], 6: [10, 17] },
};

// Choices on the public forms (the server accepts exactly these).
export const FORM_CHOICES = {
  fosterAnimals: ['Dogs', 'Puppies', 'Cats', 'Kittens', 'Rabbits'],
  fosterLengths: ['A few days', 'A few weeks', 'A month or more'],
  volunteerInterests: ['Dog walking', 'Cat socializing', 'Adoption events', 'Cleaning and laundry', 'Photography'],
  days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  times: ['Morning', 'Afternoon'],
  contactTopics: ['Adopting', 'Fostering', 'Volunteering', 'Donations', 'Something else'],
};

// "Our story" timeline.
export const TIMELINE = [
  { year: '2019', title: 'A garage and three dogs', text: 'A group of neighbours in Arlington started taking in strays from the street, three dogs at a time.' },
  { year: '2021', title: 'Our first real shelter', text: 'We moved into the building on Shelter Lane, with room for 40 animals and a small clinic.' },
  { year: '2023', title: 'Fostering takes off', text: 'Local families began fostering kittens and puppies, doubling the number of animals we could help.' },
  { year: '2025', title: 'Paper records hit their limit', text: 'Two families applied for the same dog on the same day. We knew we needed one shared system.' },
  { year: '2026', title: 'This website', text: 'Every animal, application, medical record and appointment now lives in one place, open to adopters online.' },
];

// The people who built this site.
export const TEAM = [
  { name: 'Ammar Baig', role: 'Client app, status history and v2.0', initials: 'AB' },
  { name: 'Rutuja Dudhagundi', role: 'Adoption workflow: applications and reviews', initials: 'RD' },
  { name: 'Omar Elsaghir', role: 'Server, data and medical records', initials: 'OE' },
];

// The main menu. Each entry opens a dropdown; `links` are its items.
export const MAIN_MENU = [
  {
    label: 'Adopt',
    links: [
      { label: 'All available animals', to: '/animals' },
      { label: 'Dogs', to: '/animals?species=Dog' },
      { label: 'Cats', to: '/animals?species=Cat' },
      { label: 'Rabbits', to: '/animals?species=Rabbit' },
      { label: 'How adoption works', to: '/adopt/how-it-works' },
      { label: 'Adoption FAQs', to: '/adopt/faqs' },
    ],
  },
  {
    label: 'Foster',
    links: [
      { label: 'About fostering', to: '/foster' },
      { label: 'Foster FAQs', to: '/foster/faqs' },
    ],
  },
  {
    label: 'Volunteer',
    links: [
      { label: 'Volunteer with us', to: '/volunteer' },
      { label: 'Volunteer FAQs', to: '/volunteer/faqs' },
    ],
  },
  {
    label: 'Donate',
    links: [
      { label: 'Ways to give', to: '/donate' },
      { label: 'Wish list', to: '/donate/wish-list' },
    ],
  },
  {
    label: 'About',
    links: [
      { label: 'Our story', to: '/about' },
      { label: 'Visit and contact us', to: '/contact' },
    ],
  },
];

// The full-screen "Menu" panel: everything, grouped.
export const MEGA_MENU = [
  { heading: 'Adopt', links: MAIN_MENU[0].links },
  {
    heading: 'Foster and volunteer',
    links: [...MAIN_MENU[1].links, ...MAIN_MENU[2].links],
  },
  { heading: 'Ways to give', links: MAIN_MENU[3].links },
  {
    heading: 'About us',
    links: [...MAIN_MENU[4].links, { label: 'Our numbers', to: '/#our-numbers' }],
  },
];

// Information pages. Each section has a heading and one of:
//   text: [paragraphs]   list: [items]   steps: [{ title, text }]
//   faqs: [{ q, a }]     (shown as open/close questions)
export const INFO_PAGES = {
  'adopt/how-it-works': {
    eyebrow: 'Adopt',
    title: 'How adoption works',
    lede: 'Four steps from "hello" to "welcome home". Most adoptions take less than a week.',
    sections: [
      {
        heading: 'The four steps',
        steps: [
          {
            title: 'Find your match',
            text: 'Browse the animals who are available today. Each profile tells you their age, size, personality and whether they get along with children, dogs and cats.',
          },
          {
            title: 'Apply online',
            text: 'Create a free account and answer a few questions about your home. It takes about ten minutes. While your application is open, no one else can apply for that animal.',
          },
          {
            title: 'We review your application',
            text: 'Our staff read every application and may call you with a question. You can follow your application on the My applications page and you will get a message as soon as we decide.',
          },
          {
            title: 'Meet and take them home',
            text: 'Once you are approved, we book a time for you to meet your new friend and take them home, along with their vaccination and medical records.',
          },
        ],
      },
      {
        heading: 'What to bring',
        list: [
          'A photo ID',
          'Your landlord’s permission if you rent',
          'A carrier or leash for the trip home',
          'The adoption fee shown on the animal’s profile',
        ],
      },
      {
        heading: 'Prefer to visit in person?',
        text: [
          'You are welcome to visit during opening hours and meet the animals first. Our staff can complete a walk-in adoption at the shelter.',
        ],
      },
    ],
    cta: { label: 'See available animals', to: '/animals' },
  },
  'adopt/faqs': {
    eyebrow: 'Adopt',
    title: 'Adoption FAQs',
    lede: 'Answers to the questions we hear most often.',
    sections: [
      {
        heading: 'Questions',
        faqs: [
          {
            q: 'Do I need an account to adopt?',
            a: 'You can browse without one. To apply, create a free account with Sign up so you can follow your application and get our messages.',
          },
          {
            q: 'Can I apply for more than one animal?',
            a: 'Yes, but each animal can only have one open application at a time, so apply for the one you would most like to meet first.',
          },
          {
            q: 'How long does a decision take?',
            a: 'Usually two to three days. You will see the decision on My applications and get a message.',
          },
          {
            q: 'Can I change my mind?',
            a: 'Yes. While your application is still waiting, you can withdraw it from My applications. The animal becomes available to other families again.',
          },
          {
            q: 'What does the adoption fee cover?',
            a: 'Vaccinations, a health check, a microchip and spay or neuter surgery where needed. The fee is shown on each animal’s profile.',
          },
          {
            q: 'What if it doesn’t work out?',
            a: 'Please bring the animal back to us. We will always take them back and help them find another home.',
          },
        ],
      },
    ],
    cta: { label: 'See available animals', to: '/animals' },
  },
  foster: {
    eyebrow: 'Foster',
    title: 'Open your home for a few weeks',
    lede: 'Fostering gives an animal a break from the shelter while they wait for a family, and frees up space for the next animal who needs us.',
    sections: [
      {
        heading: 'Who we look for',
        list: [
          'Anyone 18 or older with a safe, quiet space',
          'Some time each day for feeding, play and a little training',
          'Transport to the shelter for vet visits',
        ],
      },
      {
        heading: 'What we provide',
        list: ['Food, bedding and supplies', 'All vet care, booked by our staff', 'A staff contact you can call any time'],
      },
      { heading: 'Sign up to foster', widget: 'fosterForm' },
      { heading: 'In foster homes right now', widget: 'fostered' },
    ],
  },
  'foster/faqs': {
    eyebrow: 'Foster',
    title: 'Foster FAQs',
    lede: 'What fostering is really like.',
    sections: [
      {
        heading: 'Questions',
        faqs: [
          { q: 'How long does fostering last?', a: 'Anywhere from a weekend to a few months. You tell us what fits your life.' },
          { q: 'Do I pay for anything?', a: 'No. We provide food, supplies and all vet care.' },
          { q: 'Can I adopt my foster animal?', a: 'Yes. Many of our fosters do. Apply the same way as any other adopter.' },
          { q: 'I have pets of my own. Can I still foster?', a: 'Usually, yes. We match you with an animal who gets along with them.' },
        ],
      },
    ],
    cta: { label: 'Contact us about fostering', to: '/contact' },
  },
  volunteer: {
    eyebrow: 'Volunteer',
    title: 'Volunteer with us',
    lede: 'A few hours a week makes a real difference to the animals and to our staff.',
    sections: [
      {
        heading: 'Ways to help',
        list: [
          'Walk and play with the dogs',
          'Socialize shy cats and rabbits',
          'Help at adoption events',
          'Wash bedding and keep the kennels clean',
          'Take photos of the animals for their profiles',
        ],
      },
      { heading: 'Sign up to volunteer', widget: 'volunteerForm' },
    ],
  },
  'volunteer/faqs': {
    eyebrow: 'Volunteer',
    title: 'Volunteer FAQs',
    lede: 'Everything you need to know before your first shift.',
    sections: [
      {
        heading: 'Questions',
        faqs: [
          { q: 'How much time do I need to give?', a: 'We ask for at least two hours a week for three months.' },
          { q: 'Do I need experience?', a: 'No. Every volunteer gets an orientation and works alongside staff at first.' },
          { q: 'Can groups volunteer?', a: 'Yes. Call us to book a group day for your class, club or workplace.' },
        ],
      },
    ],
    cta: { label: 'Visit and contact us', to: '/contact' },
  },
  donate: {
    eyebrow: 'Donate',
    title: 'Ways to give',
    lede: 'Gifts pay for food, vaccinations and surgery for every animal in our care.',
    sections: [
      {
        heading: 'How you can help',
        list: [
          'Give at the front desk during opening hours',
          'Bring something from our wish list',
          'Sponsor an animal’s adoption fee',
          'Hold a fundraiser at your school or workplace',
        ],
      },
      {
        heading: 'Good to know',
        text: ['This website does not take payments. Please give in person or call us and we will help.'],
      },
      { heading: 'Most needed this week', widget: 'wishPreview' },
    ],
    cta: { label: 'See the full wish list', to: '/donate/wish-list' },
  },
  'donate/wish-list': {
    eyebrow: 'Donate',
    title: 'Wish list',
    lede: 'The things we use up fastest. Pick something, tell us how many you will bring, and watch the bar fill up.',
    sections: [{ heading: 'What we need right now', widget: 'wishList' }],
  },
  about: {
    eyebrow: 'About us',
    title: 'Our story',
    lede: 'Paws Shelter finds homes for dogs, cats, rabbits and birds who need a second chance.',
    sections: [
      {
        heading: 'What we do',
        text: [
          'We care for every animal until they find a family: food, shelter, vet care and a lot of attention. Every animal’s status, medical history and applications are kept in one place, so our staff always know who is ready to go home.',
        ],
      },
      { heading: 'Our impact today', widget: 'impact' },
      { heading: 'How we got here', widget: 'timeline' },
      {
        heading: 'Our promise to adopters',
        list: [
          'Honest profiles, including what each animal finds hard',
          'A clear decision on every application, with a message to tell you',
          'We always take an animal back if it doesn’t work out',
        ],
      },
      {
        heading: 'Who built this website',
        text: [
          'This site is a class project for CSE 5324 at the University of Texas at Arlington. Paws Shelter, its story, address and phone number are made up for the project.',
        ],
        widget: 'team',
      },
    ],
    cta: { label: 'Meet the animals', to: '/animals' },
  },
  contact: {
    eyebrow: 'About us',
    title: 'Visit and contact us',
    lede: 'Come and meet the animals. No appointment needed during opening hours.',
    sections: [
      { heading: 'Are we open?', widget: 'openNow' },
      { heading: 'Find us', contact: true },
      { heading: 'Send us a message', widget: 'contactForm' },
    ],
    cta: { label: 'See available animals', to: '/animals' },
  },
};
