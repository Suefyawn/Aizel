-- Migration 095 — create the footer content pages (P1).
--
-- Cowork QA found 5 of 6 footer links 404: /page/about, /page/contact,
-- /page/shipping, /page/returns, /page/faq. The QA report assumed the
-- content existed (9 CMS rows) — but those 9 rows are WordPress *system*
-- pages (cart, checkout, home, my-account, shop, blog, …), not real
-- content. About / Contact / Shipping / Returns / FAQ were never created.
--
-- This seeds them. The shipping + returns terms intentionally match what
-- the storefront already states on every PDP (flat PKR 200, free over
-- PKR 2,500, COD nationwide, 7-day return on unopened items) so the site
-- is internally consistent. Starter content — the owner can refine it.
--
-- Idempotent: each insert is guarded with NOT EXISTS on the slug.

insert into public.pages (slug, title, body_html, excerpt, status, meta_title, meta_description, show_in_footer, sort_order)
select 'about', 'About Yellow Pink',
$html$<p>Yellow Pink is a Pakistan-based beauty and wellness store. We bring a tightly curated edit of imported skincare, makeup, and wellness supplements to customers across the country &mdash; the products we would actually recommend to a friend.</p>
<p>Every order is hand-checked before it ships, with Cash on Delivery available nationwide. We are a small team and we read every message, so if something is not right, tell us and we will make it right.</p>
<h2>What we stand for</h2>
<ul>
<li><strong>Genuine products</strong> &mdash; sourced carefully, never counterfeit.</li>
<li><strong>Honest pricing</strong> &mdash; fair prices, with regular offers for our newsletter subscribers.</li>
<li><strong>Real support</strong> &mdash; message us on WhatsApp and talk to a person, not a script.</li>
</ul>$html$,
'A curated beauty and wellness store delivering genuine imported products across Pakistan.',
'published', 'About Yellow Pink', 'Yellow Pink is a Pakistan-based store for curated, genuine imported beauty and wellness products.', true, 1
where not exists (select 1 from public.pages where slug = 'about');

insert into public.pages (slug, title, body_html, excerpt, status, meta_title, meta_description, show_in_footer, sort_order)
select 'contact', 'Contact Us',
$html$<p>We are here to help &mdash; before, during, and after your order.</p>
<h2>WhatsApp</h2>
<p>The fastest way to reach us is WhatsApp: <a href="https://wa.me/923004374577">+92 300 4374577</a>. We typically reply within a few hours, 7 days a week.</p>
<h2>Order questions</h2>
<p>For anything about an existing order, reply directly to your order confirmation email, or check its progress any time at <a href="/track">Track Order</a>.</p>
<h2>Hours</h2>
<p>We answer messages from 10am to 8pm PKT. Anything sent outside these hours is answered first thing the next day.</p>$html$,
'Reach Yellow Pink on WhatsApp at +92 300 4374577, 7 days a week.',
'published', 'Contact Yellow Pink', 'Contact Yellow Pink on WhatsApp at +92 300 4374577 for help with orders, products, and returns.', true, 2
where not exists (select 1 from public.pages where slug = 'contact');

insert into public.pages (slug, title, body_html, excerpt, status, meta_title, meta_description, show_in_footer, sort_order)
select 'shipping', 'Shipping Policy',
$html$<h2>Delivery charges</h2>
<ul>
<li>Flat shipping of <strong>PKR 200</strong> on all orders.</li>
<li><strong>Free shipping</strong> on orders over <strong>PKR 2,500</strong>.</li>
</ul>
<h2>Coverage and timing</h2>
<p>We deliver nationwide across Pakistan. Orders are dispatched within 1&ndash;2 working days, and most deliveries arrive within <strong>2&ndash;5 working days</strong> depending on your city.</p>
<h2>Payment</h2>
<p>Cash on Delivery is available everywhere we ship. You can also pay in advance with JazzCash, Easypaisa, card, or bank transfer at checkout.</p>
<h2>Tracking</h2>
<p>Once your order ships you will receive a tracking number by email. You can also check status any time at <a href="/track">Track Order</a>.</p>$html$,
'Flat PKR 200 shipping, free over PKR 2,500, with nationwide Cash on Delivery.',
'published', 'Shipping Policy', 'Yellow Pink shipping: flat PKR 200, free over PKR 2,500, Cash on Delivery nationwide, 2-5 working days.', true, 3
where not exists (select 1 from public.pages where slug = 'shipping');

insert into public.pages (slug, title, body_html, excerpt, status, meta_title, meta_description, show_in_footer, sort_order)
select 'returns', 'Returns & Refunds',
$html$<p>If something is not right, we want to fix it.</p>
<h2>7-day returns</h2>
<p>You may return an item within <strong>7 days</strong> of delivery, provided it is <strong>unopened and unused</strong> in its original packaging.</p>
<h2>For hygiene reasons</h2>
<p>Opened skincare, makeup, and supplements cannot be returned once the seal is broken &mdash; unless the item arrived damaged or incorrect.</p>
<h2>Damaged or wrong item</h2>
<p>If your order arrives damaged, or you received the wrong product, message us on <a href="https://wa.me/923004374577">WhatsApp</a> within 48 hours of delivery with a photo. We will arrange a replacement or refund at no cost to you.</p>
<h2>How to start a return</h2>
<p>Message us on <a href="https://wa.me/923004374577">WhatsApp (+92 300 4374577)</a> with your order number. Approved refunds are issued to your original payment method &mdash; or as a bank transfer for Cash on Delivery orders &mdash; within 5&ndash;7 working days of us receiving the item.</p>$html$,
'Return unopened items within 7 days of delivery. Damaged or wrong items are replaced free.',
'published', 'Returns & Refunds', 'Yellow Pink returns: unopened items within 7 days, free replacement for damaged or incorrect orders.', true, 4
where not exists (select 1 from public.pages where slug = 'returns');

insert into public.pages (slug, title, body_html, excerpt, status, meta_title, meta_description, show_in_footer, sort_order)
select 'faq', 'Frequently Asked Questions',
$html$<h2>Are your products genuine?</h2>
<p>Yes. We source every product carefully and never sell counterfeit goods.</p>
<h2>How long does delivery take?</h2>
<p>Orders are dispatched within 1&ndash;2 working days and most arrive within 2&ndash;5 working days nationwide.</p>
<h2>How much is shipping?</h2>
<p>Shipping is a flat PKR 200, and free on orders over PKR 2,500.</p>
<h2>Can I pay cash on delivery?</h2>
<p>Yes, Cash on Delivery is available nationwide. You can also pay with JazzCash, Easypaisa, card, or bank transfer.</p>
<h2>Can I track my order?</h2>
<p>Yes &mdash; you receive a tracking number by email once your order ships, and you can check status at <a href="/track">Track Order</a>.</p>
<h2>What is your return policy?</h2>
<p>Unopened items can be returned within 7 days of delivery. See our <a href="/page/returns">Returns &amp; Refunds</a> page for details.</p>
<h2>How do I contact you?</h2>
<p>Message us on WhatsApp at <a href="https://wa.me/923004374577">+92 300 4374577</a> &mdash; we reply 7 days a week.</p>$html$,
'Answers on genuine products, delivery time, shipping cost, payment, tracking, and returns.',
'published', 'FAQ', 'Frequently asked questions about Yellow Pink: genuine products, delivery, shipping, payment, and returns.', true, 5
where not exists (select 1 from public.pages where slug = 'faq');
