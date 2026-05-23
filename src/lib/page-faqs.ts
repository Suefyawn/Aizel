// FAQ content keyed by CMS page slug. When the merchant publishes a CMS page
// (via WordPress import or admin) whose slug matches one of these keys, the
// page route layers in FAQPage JSON-LD so the questions can appear as
// expandable cards in Google search results.
//
// Keep the questions and answers in sync with the human-readable copy on the
// CMS page itself. Google's FAQ guidelines require the JSON-LD answer text to
// be visible on the rendered page — paste-equivalents only, no exclusive content.
//
// To add coverage for a new page, append a new key here and ensure the same
// Q/A pairs are present in the CMS page body.

export interface FaqEntry {
  question: string;
  answer: string;
}

const FAQS: Record<string, FaqEntry[]> = {
  shipping: [
    {
      question: 'How long does UK delivery take?',
      answer:
        'Mainland UK orders typically arrive in 2 to 3 working days via Royal Mail Tracked 24/48 or DPD. Highlands, Islands, and Northern Ireland may take up to 5 working days. Orders confirmed before 2 PM ship the same day.',
    },
    {
      question: 'When does free shipping apply?',
      answer:
        'Free standard UK delivery is automatically applied to orders over £15. Below that threshold, a flat shipping fee is calculated at checkout.',
    },
    {
      question: 'Which courier services do you use?',
      answer:
        'We dispatch via Royal Mail Tracked and DPD depending on parcel size and your delivery postcode. You receive a tracking number by email as soon as your parcel is collected.',
    },
    {
      question: 'Can I change my delivery address after placing an order?',
      answer:
        'Yes, if your order has not yet been dispatched. Contact us through the help page with your order number and the corrected address; we will update it before the parcel ships.',
    },
  ],
  returns: [
    {
      question: 'What is your return window?',
      answer:
        'You can request a return within 14 days of delivery for unopened, unused items in their original packaging. Opened or used items are not eligible unless they arrived damaged or defective.',
    },
    {
      question: 'How do I request a return?',
      answer:
        'Sign in to your account, open the relevant order, and tap "Request return". A confirmation email is sent once our team approves the request, along with pickup or drop-off instructions.',
    },
    {
      question: 'Who pays for return shipping?',
      answer:
        'For damaged, defective, or wrong-item shipments, we cover the return courier fee. For other reasons (changed mind, wrong shade), the customer arranges the return at their own cost.',
    },
    {
      question: 'How are refunds issued?',
      answer:
        'Refunds are issued to the original payment method within 5 working days of receiving the returned item. Store credit is also available as a faster alternative if you prefer.',
    },
  ],
  faq: [
    {
      question: 'Are your products authentic?',
      answer:
        'Yes — every product we list is sourced from authorised distributors or direct from international brand websites. We do not stock counterfeits, and serial-coded items can be verified on the brand website.',
    },
    {
      question: 'How do I track my order?',
      answer:
        'Open the Track Order page and enter your order number along with the email used at checkout. You will see the live courier status plus a link directly to the courier tracking page.',
    },
    {
      question: 'Do you ship outside the UK?',
      answer:
        'Not at the moment. We currently ship only within the United Kingdom with card, PayPal, and bank transfer payment options.',
    },
    {
      question: 'How can I contact customer support?',
      answer:
        'Reach us via the Contact page or by replying to your order confirmation email. We respond to most enquiries within one working day, Monday to Friday.',
    },
  ],
};

export function getPageFaq(slug: string): FaqEntry[] | null {
  return FAQS[slug] ?? null;
}
