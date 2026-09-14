import { prisma } from '@/lib/db';
import { fetchSallaCatalog, resolveSallaStorefrontUrl } from '@/lib/salla';
import { pushOrderToSalla } from '@/lib/salla-sync';
import { findCustomerOrder, statusReply, normalizePhone } from '@/lib/orders';
import { formatOrderSummary, parseCatalogOrder, type ParsedCatalogOrder } from '@/lib/catalog-order';
import { nowTime } from '@/lib/whatsapp';

export function appBaseUrl() {
  return process.env.APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
}

export function isStatusQuery(text: string) {
  return /status|where|tracking|حالة|فين|أين|تتبع/i.test(text);
}

export function isMenuQuery(text: string) {
  return /^(مرحبا|السلام|اهلا|هلو|hello|hi|مرحب|مساء|صباح)/i.test(text)
    || /menu|منيو|قائمة|قايمة|المنتجات|browse|عرض|استعراض/i.test(text);
}

export function isConfirmQuery(text: string) {
  return /^(نعم|أكيد|اكد|أكد|تأكيد|confirm|yes|موافق|اوكي|ok)(?:\s|$|[!.])/i.test(text.trim());
}

export function isLocationMessage(text: string) {
  const locationMarkers = /حي|شارع|مدينة|محافظة|منطقة|جزيرة|قرية|ميدان|المعادي|القاهرة|الرياض|جدة|الدمام|مكة|street|district|city|zone|st\./i;
  if (!locationMarkers.test(text)) return false;
  const productWords = /كيلو|kg|قطعة|حبة|حزمة|طماطم|خيار|بصل|جزر|بطاطس|تفاح|برتقال|موز/i;
  return !productWords.test(text);
}

export async function ensureConversation(phone: string, name: string) {
  const existing = await prisma.conversation.findFirst({ where: { phone: { contains: phone } } });
  if (existing) return existing;
  return prisma.conversation.create({
    data: { customerName: name, phone, customerType: 'retail', status: 'active', lastActivity: nowTime() },
  });
}

export async function ensureMenuPage(phone: string, name: string) {
  const existing = await prisma.menuPage.findFirst({ where: { phone: { contains: phone } }, orderBy: { createdAt: 'desc' } });
  if (existing) return existing;
  const slug = `wa-${phone.slice(-10)}-${Math.random().toString(36).slice(2, 8)}`;
  return prisma.menuPage.create({
    data: { slug, customerName: name, phone, customerType: 'retail' },
  });
}

export function menuLinkFor(slug: string) {
  return `${appBaseUrl().replace(/\/$/, '')}/menu/${slug}`;
}

export async function publicMenuUrl() {
  return (await resolveSallaStorefrontUrl()) ?? `${appBaseUrl().replace(/\/$/, '')}/menu`;
}

async function loadCatalog() {
  try {
    return await fetchSallaCatalog();
  } catch {
    return [];
  }
}

function parseDraft(text: string): ParsedCatalogOrder & { location?: string } | null {
  try {
    const parsed = JSON.parse(text) as ParsedCatalogOrder & { location?: string };
    if (!parsed?.items?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function latestDraft(conversationId: string) {
  const message = await prisma.message.findFirst({
    where: { conversationId, type: 'order_draft' },
    orderBy: { id: 'desc' },
  });
  return message ? parseDraft(message.text) : null;
}

async function saveDraft(conversationId: string, draft: ParsedCatalogOrder & { location?: string }) {
  await prisma.message.create({
    data: { conversationId, sender: 'bot', text: JSON.stringify(draft), time: nowTime(), type: 'order_draft' },
  });
}

async function resolveLocalProductId(sallaOrLocalId: string) {
  const bySalla = await prisma.product.findUnique({ where: { sallaProductId: sallaOrLocalId } }).catch(() => null);
  if (bySalla) return bySalla.id;
  return null;
}

async function placeDraftOrder(input: {
  conversationId: string;
  phone: string;
  name: string;
  menuPageId: string;
  draft: ParsedCatalogOrder & { location?: string };
}) {
  const blocked = input.draft.items.find((item) => !item.purchasable || item.qty > item.stock);
  if (blocked) {
    return { error: `الصنف غير متاح بالكمية المطلوبة: ${blocked.nameAr || blocked.name}` };
  }
  const orderId = `ORD-${Date.now().toString().slice(-6)}`;
  await prisma.order.create({
    data: {
      id: orderId,
      customerName: input.name,
      customerPhone: input.phone,
      customerType: 'retail',
      paymentMethod: 'cod',
      total: input.draft.total,
      status: 'pending',
      paymentStatus: 'cod',
      location: input.draft.location ?? null,
      menuPageId: input.menuPageId,
    },
  });
  const items = await Promise.all(input.draft.items.map(async (item) => ({
    orderId,
    productId: await resolveLocalProductId(item.id),
    productName: item.name,
    qty: item.qty,
    unit: item.unit,
    unitPrice: item.price,
  })));
  await prisma.orderItem.createMany({ data: items });
  await prisma.conversation.update({
    where: { id: input.conversationId },
    data: { orderId, status: 'active', lastActivity: nowTime() },
  });
  let sallaNote = '';
  try {
    await pushOrderToSalla(orderId);
    sallaNote = 'وتم إرسال الطلب إلى سلة.';
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Salla push failed';
    await prisma.order.update({ where: { id: orderId }, data: { sallaSyncStatus: 'failed', sallaSyncError: message } }).catch(() => undefined);
    sallaNote = 'سيتم مزامنة الطلب مع سلة بعد قليل.';
  }
  return { orderId, sallaNote };
}

export async function handleWhatsAppText(input: { phone: string; text: string; name?: string }) {
  const phone = normalizePhone(input.phone);
  const name = input.name?.trim() || 'WhatsApp customer';
  const conversation = await ensureConversation(phone, name);
  await prisma.message.create({ data: { conversationId: conversation.id, sender: 'customer', text: input.text, time: nowTime(), type: 'whatsapp' } });

  const menuPage = await ensureMenuPage(phone, name);
  const menuUrl = await publicMenuUrl();
  let reply: string;

  if (isStatusQuery(input.text) && !parseCatalogOrder(input.text, await loadCatalog())) {
    const order = await findCustomerOrder(input.text.match(/ORD[- ]?\d+/i)?.[0]?.replace(' ', '-'), phone);
    reply = order ? statusReply(order) : 'لم نجد طلباً مرتبطاً بهذا الرقم. أرسل رقم الطلب مثل ORD-123456 أو اطلب من القائمة.';
  } else if (isConfirmQuery(input.text)) {
    const draft = await latestDraft(conversation.id);
    if (!draft) {
      reply = `لا يوجد طلب قيد التأكيد. اكتب أصنافك أو افتح القائمة:\n${menuUrl}`;
    } else if (!draft.location) {
      reply = 'قبل التأكيد، أرسل عنوان التوصيل بالتفصيل (الحي، الشارع، ورقم المبنى).';
    } else {
      const placed = await placeDraftOrder({ conversationId: conversation.id, phone, name, menuPageId: menuPage.id, draft });
      reply = placed.error
        ? `${placed.error}\nيمكنك تعديل الطلب من القائمة:\n${menuUrl}`
        : `تم تسجيل طلبك ✅\nرقم الطلب: ${placed.orderId}\n${formatOrderSummary(draft)}\n${placed.sallaNote}`;
    }
  } else if (isLocationMessage(input.text)) {
    const draft = await latestDraft(conversation.id);
    if (draft) {
      await saveDraft(conversation.id, { ...draft, location: input.text.trim() });
      reply = `تم حفظ العنوان: ${input.text.trim()}\nأرسل "نعم" لتأكيد الطلب وإرساله إلى سلة.`;
    } else {
      reply = `تم تسجيل موقعك. اكتب طلبك أو افتح قائمة سلة:\n${menuUrl}`;
    }
  } else {
    const catalog = await loadCatalog();
    const parsed = catalog.length ? parseCatalogOrder(input.text, catalog) : null;
    if (parsed) {
      const unavailable = parsed.items.filter((item) => !item.purchasable || item.qty > item.stock);
      if (unavailable.length) {
        reply = `هذه الأصناف غير متاحة حالياً من سلة: ${unavailable.map((item) => item.nameAr || item.name).join(', ')}\nراجع التوفر من القائمة:\n${menuUrl}`;
      } else {
        await saveDraft(conversation.id, parsed);
        const unmatched = parsed.unmatched.length ? `\nلم نتعرف على: ${parsed.unmatched.join(', ')}` : '';
        reply = `تم فهم طلبك من كتالوج سلة:\n${formatOrderSummary(parsed)}${unmatched}\n\nأرسل عنوان التوصيل ثم اكتب "نعم" للتأكيد.\nأو عدّل الأصناف من القائمة:\n${menuUrl}`;
      }
    } else if (isMenuQuery(input.text) || !catalog.length) {
      reply = catalog.length
        ? `أهلاً بك 🌿\nاطلب بكتابة الأصناف والكميات، مثل: "5 كيلو طماطم و 3 كيلو خيار"\nأو تصفح قائمة المتجر من سلة:\n${menuUrl}`
        : `أهلاً بك. قائمة المتجر مرتبطة بسلة. افتح قائمتك:\n${menuUrl}\nإذا كانت فارغة فالمتاجر غير متصل بعد.`;
    } else {
      reply = `يمكنك كتابة طلبك مباشرة أو فتح قائمة سلة:\n${menuUrl}`;
    }
  }

  await prisma.message.create({ data: { conversationId: conversation.id, sender: 'bot', text: reply, time: nowTime(), type: 'whatsapp' } });
  await prisma.conversation.update({ where: { id: conversation.id }, data: { lastActivity: nowTime(), status: 'active' } });
  return { reply, conversationId: conversation.id, menuUrl };
}
