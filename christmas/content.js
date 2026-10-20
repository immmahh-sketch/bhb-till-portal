/* What the Black Horse Beamish website and the 2026 Christmas brochure say, read on 20 October 2026.
   This is public information (nothing private belongs in this file). Where the website is missing something or contradicts itself, it is listed in FLAGS
   so it can be fixed at the source; the action plan carries the same points. Prices are per person unless stated. */
const XMAS = {
  checked: "20 October 2026",
  site: "https://www.blackhorsebeamish.co.uk",
  contact: { phone: "01207 232 569", events: "events@blackhorsebeamish.co.uk", stay: "stay@blackhorsebeamish.co.uk", restaurant: "restaurant@blackhorsebeamish.co.uk", address: "Red Row Estate, Beamish, County Durham, DH9 0RW" },
  links: {
    brochure: "https://www.blackhorsebeamish.co.uk/s/Christmas20Brochure20202620-compressedC2A028129.pdf",
    dayMenu: "https://www.blackhorsebeamish.co.uk/s/Christmas20Day20Menu202026.pdf",
    teaMenu: "https://www.blackhorsebeamish.co.uk/s/Festive-Tea.pdf",
    partyMenu: "https://www.blackhorsebeamish.co.uk/s/Private-Dining-Menu-tb7c.pdf",
    book: "https://booking.resdiary.com/widget/Standard/BlackHorseBeamish/57122",
    vouchers: "https://blackhorsebeamish.vouchable.co.uk/",
    dayTickets: "https://www.ticketsource.com/blackhorsebeamish/t-rzjlajd"
  },

  /* dates that matter, soonest first; the page shows the ones still to come */
  keyDates: [
    { d: "2026-10-31", t: "Corporate Christmas bookings: last day to cancel, at the loss of the deposit only (16:00)" },
    { d: "2026-11-25", t: "Christmas Day: table times confirmed to guests (the pre-order form promises this date)" },
    { d: "2026-11-26", t: "First wreath making evening" },
    { d: "2026-12-01", t: "Christmas Fayre menu and Festive Afternoon Tea begin" },
    { d: "2026-12-05", t: "Party night: Hits of the 90s" },
    { d: "2026-12-06", t: "Festive Sunday Lunch (also 13 and 20 December)" },
    { d: "2026-12-12", t: "Party night: Flash Freddie" },
    { d: "2026-12-13", t: "Christmas Market, 11am to 4pm" },
    { d: "2026-12-18", t: "Party night: Stevie D (all inclusive drinks)" },
    { d: "2026-12-24", t: "Christmas Eve: breakfast, lunch and afternoon tea" },
    { d: "2026-12-25", t: "Christmas Day: six courses, 12pm to 3.30pm" },
    { d: "2026-12-26", t: "Boxing Day: full restaurant menu" },
    { d: "2026-12-31", t: "New Year's Eve: normal menu, main menu 12pm to 9pm" }
  ],

  /* shows sold through TicketSource. "match" finds the show in the ticket sales sync by its name; "date" is the show date. */
  events: [
    { id: "wreath1", title: "Wreath Making", date: "2026-11-26", time: "6pm to 9pm", match: /wreath/i, ticket: "https://www.ticketsource.com/blackhorsebeamish/t-kdpozlz",
      text: "Craft your own Christmas wreath. Includes a glass of prosecco on arrival, a mince pie and festive drink, and all equipment, with holly, ivy and spruce from the estate. Guests may bring their own items to personalise it.", page: "/wreath-making" },
    { id: "wreath2", title: "Wreath Making", date: "2026-12-03", time: "6pm to 9pm", match: /wreath/i, ticket: "https://www.ticketsource.com/blackhorsebeamish/t-qmzvygn", text: "As above.", page: "/wreath-making" },
    { id: "wreath3", title: "Wreath Making", date: "2026-12-10", time: "6pm to 9pm", match: /wreath/i, ticket: "https://www.ticketsource.com/blackhorsebeamish/t-ldxkvmn", text: "As above.", page: "/wreath-making" },
    { id: "hits90", title: "Hits of the 90s (Christmas party night)", date: "2026-12-05", time: "7pm to midnight", match: /hits of the 90/i, ticket: "https://www.ticketsource.com/blackhorsebeamish/hits-of-the-90s/2026-12-05/19:00/t-plmjodl",
      text: "Two-course Christmas meal, then dancing to the biggest hits of the 90s with Tyler's 90s. 6:30pm arrival, 7pm food, 7:30pm music, midnight close.", page: "/viewallevents/hits-of-the-90s", menu: "partyMenu" },
    { id: "freddie", title: "Flash Freddie (Christmas party night)", date: "2026-12-12", time: "7pm to midnight", match: /flash freddie/i, ticket: "https://www.ticketsource.com/blackhorsebeamish/flash-freddie/2026-12-12/19:00/t-yzeogxy",
      text: "Two-course festive meal, then a Freddie Mercury tribute show. 6:30pm arrival, 7pm food, 7:30pm music, midnight close.", page: "/viewallevents/flash-freddie", menu: "partyMenu" },
    { id: "stevie", title: "Stevie D Party Band, all inclusive drinks (Christmas party night)", date: "2026-12-18", time: "7pm to midnight", match: /stevie/i, ticket: "",
      text: "Two-course festive meal, then The Stevie D Party Band (Billy Ocean, Lionel Richie, Queen, Bon Jovi and more). Drinks are all inclusive. 6:30pm arrival, 7pm food, 7:30pm music, midnight close.", page: "/viewallevents/the-stevie-d-band", menu: "partyMenu",
      note: "All-inclusive rules (brochure): house wine, selected draughts, house spirits, post-mix soft drinks and J2O, 0% lager and gin are included; premium drinks cost extra. Wristbands issued. Up to two drinks per round (self plus one). One glass each at a time. The inclusive bar runs from the start until 11pm, then full price." }
  ],
  market: {
    title: "Christmas Market", date: "2026-12-13", time: "11am to 4pm", entry: "Free, no ticket needed", page: "/viewallevents/christmas-market",
    text: "Festive craft, food and artisan stalls (artists, jewellery makers, ceramicists, bakers), food, fresh tea and coffee. Dogs welcome.",
    stall: "Stall fee £30 including a 6ft trestle table and cloth. Every stallholder needs valid Public Liability Insurance and must provide proof. Successful applicants are contacted; not every applicant gets a reply.",
    apply: "/market-vendor-application"
  },

  dining: [
    { id: "fayre", title: "Christmas Fayre menu", when: "From 1 December, alongside the main menu", price: "",
      text: "Available to every restaurant customer. The restaurant and bar are open Monday to Sunday throughout December. State the menu preference when booking." },
    { id: "sunday", title: "Festive Sunday Lunch", when: "Sundays 6, 13 and 20 December, 12pm to 6pm", price: "",
      text: "Booking is essential. Tables over 10 need a pre-order and a £10 per person deposit; dietary requirements go on the pre-order form." },
    { id: "tea", title: "Festive Afternoon Tea", when: "Monday to Saturday, 12pm to 4pm, 1 to 31 December (not 25 or 26 December)", price: "£26.95 per person, £9.95 per child (under 10)",
      text: "Non-refundable £10 per person deposit at booking. 10% discretionary gratuity. 48 hours' notice for changes or cancellations. Dietary requirements at booking. Add Baileys hot chocolate £5.95 or a glass of festive fizz £7.95.",
      menu: ["Black Forest brownie", "Christmas pudding bonbon", "Mini mince pie", "Macaron", "Mini trifle", "Fruit scone and cheese scone with Tiptree jam and clotted cream", "Brie and cranberry quiche", "Festive sausage roll", "Sandwiches (may vary): turkey and cranberry; honey glazed ham and mustard; smoked salmon and horseradish; prawn Marie Rose; cheese savoury", "Unlimited tea and coffee"],
      link: "teaMenu" },
    { id: "eve", title: "Christmas Eve, Thursday 24 December", when: "Breakfast 8am to 10am. Lunch and afternoon tea 12pm to 3.30pm (last sitting 3.15pm, last order 3.30pm)", price: "",
      text: "Booking is essential. Tables over 10 need a pre-order and a £10 per person deposit." },
    { id: "day", title: "Christmas Day, Friday 25 December", when: "12pm to 3.30pm, subject to availability", price: "£119 adult, £59 child, under 3s free",
      text: "Six courses in the restaurant or the Orchard Marquee. See the Christmas Day tab.", tab: "day" },
    { id: "boxing", title: "Boxing Day, Friday 26 December", when: "Breakfast 8am to 10am. Main menu 12pm to 6pm, last orders 6pm", price: "", text: "Full restaurant menu (the brochure also mentions Sunday lunch). Booking rules as for Christmas Eve." },
    { id: "nye", title: "New Year's Eve, Thursday 31 December", when: "Breakfast 8am to 10am. Main menu 12pm to 9pm", price: "", text: "Normal menu and usual opening hours. Tables over 10 need a pre-order and a £10 per person deposit." }
  ],
  booking: [
    "Parties under 8 book online (ResDiary). Parties over 8 phone 01207 232 569.",
    "Tables over 10 need a pre-order and a £10 per person deposit; dietary requirements go on the pre-order form.",
    "A 10% discretionary gratuity is added to every bill.",
    "Please inform us of any dietary requirements or allergens when booking; if not received in advance the kitchen will do its best on the day but cannot guarantee it."
  ],
  vouchers: ["Afternoon Tea for Two with Bubbly", "Gentlemen's Afternoon Tea", "Luxury Stays with Dinner and a Hearty Breakfast"],

  day: {
    price: { adult: 119, child: 59 }, when: "Friday 25 December 2026, 12pm to 3.30pm, subject to availability", where: "The restaurant or the Orchard Marquee",
    includes: "A glass of prosecco on arrival, festive canapés on arrival, and a special gift from the Black Horse Beamish for every guest, adults and children. Under 3s are free.",
    menu: [
      { h: "Canapés on arrival", i: ["Festive canapés"] },
      { h: "Starters", i: ["Celeriac and green apple soup (V, VE, GFA), with bread roll", "Luxury seafood cocktail (GFA), Bloody Mary sauce, baby gem, buttered whole grain bread", "Pressed duck terrine, red onion relish, truffle, toasted brioche", "Goat's cheese and beetroot tart (V), rocket, balsamic glaze"] },
      { h: "Palate cleanser", i: ["Palate cleanser"] },
      { h: "Mains", i: ["Roast turkey with all the festive trimmings (sage and onion stuffing, pigs in blankets, roast potatoes, seasonal vegetables, turkey gravy)", "Slow roasted feather blade of beef with all the festive trimmings (beef gravy)", "Pan-seared seabass fillet (GF), crushed potatoes, seafood bisque, wilted spinach", "Wild mushroom and chestnut Wellington (V), vegetarian gravy, sage and onion stuffing, roast potatoes, seasonal vegetables"] },
      { h: "Desserts", i: ["Traditional Christmas pudding (V, VE), brandy snap and brandy sauce", "Poached pear and gingerbread cheesecake", "Dark chocolate fondant, boozy cherries, pistachio crumb", "Selection of local British cheeses, crackers, carrot and apricot chutney"] },
      { h: "To finish", i: ["Mince pies, tea and filter coffee"] }
    ],
    notes: ["Dietary requirements and allergens when booking; if not received in advance the kitchen will do its best on the day but it cannot be guaranteed.", "Substitutions may be made where necessary. 10% discretionary gratuity is added to each bill.", "Children's menu: the brochure says it is on the website, and it was not found on the Christmas or Festive Dining pages. The pre-order form gives children a smaller portion of any adult dish, or Mozzarella Sticks / Tomato Soup, Tomato Pasta, Chocolate Brownie / Ice Cream."]
  },
  stays: [
    { title: "Indulgent Christmas Break", price: "3 nights 24 to 27 December £850. 2 nights 24 to 26 December £600.",
      text: "Check in from 3pm (latest dining reservation before check-in 3.15pm). Christmas Eve welcome Prosecco and charcuterie board at 7.30pm. Christmas Day lunch (pre-booking required). Christmas Day evening hamper with seasonal treats and a bottle of house wine. Full English breakfast each morning. £40 dining allowance per couple on Boxing Day (three-night stays only)." },
    { title: "Festive Overnight Treat", price: "From £189 per night, Sunday to Thursday, 25 November to 24 December 2026",
      text: "One night in an Old Red Row Room for two, a bottle of chilled prosecco in the room, a £40 dining allowance per couple off the main menu (Sunday stays include a two-course Sunday lunch), full English breakfast for two the next morning." }
  ],

  corporate: {
    intro: "From small teams of 10 to company-wide celebrations of 300+. Choose festive dining menus, gourmet buffets, sharing platters or canapés, with wines, festive cocktails and fully stocked bars.",
    spaces: [{ n: "Orchard Marquee", t: "Seats up to 500. Banquets, celebrations, concerts, awards, larger corporate events." }, { n: "George Ridley Suite", t: "Seats up to 40. Smaller meetings, team away days, training." }, { n: "Private dining", t: "Parties of up to 150 from intimate dinners to large corporate functions." }],
    addons: ["Professional DJs", "Live bands", "Casino tables", "Photo booths", "Magicians", "Saxophonists", "Dance floors", "Festive décor upgrades"],
    menu: {
      title: "Private dining menu (Christmas 2026)", price: "Two courses £34.95. Three courses £45.95.",
      sections: [
        { h: "Starters", i: ["Winter broth (VE) (GFA), root vegetable consommé, winter herbs, lentils", "Smoked salmon and prawn cocktail (GFA), Atlantic prawns, Marie Rose espuma, baby gem, lemon oil, brown bread", "Breaded brie, panko crumb, cranberry reduction, toasted walnuts"] },
        { h: "Mains", i: ["Traditional roast turkey, seasonal roast vegetables, garlic roast potatoes, creamy mash, chestnut and apple stuffing, bone marrow gravy", "Slow-cooked featherblade of beef, same trimmings", "Lentil and tomato roast, same trimmings, vegetable gravy", "Pan-seared salmon, champ smashed potatoes, butter braised asparagus, creamy moules sauce"] },
        { h: "Desserts", i: ["Traditional Christmas pudding, brandy sauce or vanilla custard", "Spiced apple charlotte, Chantilly cream", "Winter berry cheesecake, sablé base, fresh berries"] }
      ],
      extras: ["Arrival mince pies and mulled wine £8", "Cheese board (British cheeses, crackers, grapes, chutney) £11", "Both for £16", "Add wine £25 per bottle", "Specialty cocktails £10 per person", "Mulled wine, mince pies, hot chocolate and cookies £9 per person"]
    },
    terms: [
      "A non-refundable deposit secures the booking. Attendee numbers, menu choices (pre-orders) and the final balance are due 1 calendar month before the event, or the venue may cancel and keep the deposit.",
      "Cancel in writing by 16:00 on 31 October of the booking year at the loss of the deposit only; after that the final balance is payable.",
      "Sums for absentees are not deductible, refundable or transferable. Anyone under 18 is not permitted unless agreed in writing. Dress code smart/casual (no sportswear).",
      "Parties are asked to meet in the pre-function bar at least 30 minutes before the event. No food or drink from outside the venue.",
      "Payments by cash, bank transfer or debit card, as one deposit payment and one balance payment: piecemeal payments carry a £5 administration charge each. Late payment interest is 4% a year over Bank of England base rate.",
      "The venue can reschedule for events beyond its control (Force Majeure); a government lockdown allows rescheduling or a full refund."
    ],
    other: "Day delegate package from £36pp and the 24hr delegate rate from £145 per room (minimum 20 delegates) are for conferences and away days: see the Corporate event hire page."
  },

  /* things on the website that are missing, out of date or inconsistent: fix at the source */
  flags: [
    { tab: "events", t: "No ticket price appears on the website pages for Wreath Making, Hits of the 90s, Flash Freddie or the Stevie D night. Visitors have to open TicketSource to find out." },
    { tab: "events", t: "The Christmas Market vendor page gives the trading time as 11pm to 4pm. The event page says 11:00 to 16:00." },
    { tab: "events", t: "The party night pages show the close as 12PM; it means midnight (the brochure says 12.00am)." },
    { tab: "dining", t: "Festive Luxury Stays says the Festive Overnight Treat runs 25 November to 24 December 2025. The 2026 brochure says 2026." },
    { tab: "dining", t: "The Christmas Eve breakfast menu link opens the 2024 to 2025 breakfast menu." },
    { tab: "dining", t: "The booking rules leave a gap: pages say parties under 8 book online, parties over 8 phone, and pre-order plus deposit for tables over 10 (the Festive Dining page says parties over 10 phone). Parties of 8 to 10 are not clearly covered." },
    { tab: "dining", t: "The Festive Luxury Stays page does not give the price of the Christmas Day lunch." },
    { tab: "day", t: "The Christmas Day tickets include 'Deposit Option' ticket types in TicketSource, so the paid figure is often half the booking value: the balance due below is what is still to collect." },
    { tab: "corporate", t: "The older party package pages (from 2022 and 2024, £24.95 to £37.95) are still searchable on the site. The 2026 prices are the private dining menu: £34.95 two courses, £45.95 three." }
  ]
};
