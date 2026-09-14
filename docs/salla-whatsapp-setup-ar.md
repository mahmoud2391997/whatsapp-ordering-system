# دليل إعداد سلة وواتساب للأعمال

هذا الدليل لمحل يستخدم **متجر سلة الحقيقي** للقائمة والدفع، وتطبيق Next.js هذا لاستقبال طلبات **واتساب للأعمال (Cloud API)** وربطها بسلة.

حساب سلة التجريبي (`demostore.salla.sa`) **ليس** للإنتاج.

ضع `https://نطاقك.com` مكان عنوان التطبيق العام (`APP_URL`) في كل الروابط أدناه، بدون شرطة مائلة في النهاية.

---

## قبل البدء

1. انشر التطبيق على عنوان **HTTPS عام**. سلة وميتا لا يقبلان `localhost` في الإنتاج.
2. جهّز قاعدة **PostgreSQL** واملأ:
   - `DATABASE_URL`
   - `DIRECT_DATABASE_URL`
3. في ملف البيئة (مثل `.env` على السيرفر):
   - `APP_URL=https://نطاقك.com`
4. بعد ضبط المتغيرات شغّل ترحيل قاعدة البيانات ثم أعد نشر التطبيق.

مرجع المتغيرات: ملف `.env.example` في جذر المشروع.

---

## الجزء الأول: تجهيز سلة للإنتاج

### 1) متجر تاجر حي (ليس تجريبيًا)

1. افتح لوحة التاجر: [https://s.salla.sa/](https://s.salla.sa/)
2. أكمل هوية المتجر، الثيم، المنتجات، ووسائل الدفع والشحن.
3. انشر الواجهة الأمامية للمتجر.
4. عطّل وضع الصيانة من:  
   [إعدادات القناة — وضع الصيانة](https://s.salla.sa/channel/settings?legacy=0#maintenance-mode)
5. انسخ رابط المتجر الحي، مثل:
   - `https://اسم-المتجر.salla.sa`
   - أو `https://salla.sa/اسم-المتجر`

ضع هذا الرابط في التطبيق:

```dotenv
NEXT_PUBLIC_SALLA_STOREFRONT_URL=https://اسم-المتجر.salla.sa
```

لا تستخدم `https://demostore.salla.sa/...`.

روابط القائمة في واتساب (`/menu`) تحوّل العميل إلى **متجر سلة الحي** وليس إلى كتالوج داخل التطبيق.

### 2) تطبيق شركاء سلة (OAuth)

1. افتح بوابة الشركاء: [https://salla.partners/](https://salla.partners/)
2. أنشئ تطبيقًا جديدًا.
3. اختر وضع التفويض **Custom Mode** (وضع مخصص).
4. الصق في التطبيق:

| الحقل | القيمة |
|---|---|
| رابط إعادة التوجيه (Redirect URI) | `https://نطاقك.com/api/salla/callback` |
| رابط الويب هوك | `https://نطاقك.com/api/webhooks/salla` |

5. الصلاحيات المطلوبة (Scopes):

```
offline_access settings.read products.read_write orders.read_write customers.read_write categories.read_write webhooks.read_write
```

`offline_access` ضروري لتجديد التوكن بعد حوالي 14 يومًا.

6. اشترك في أحداث المتجر على الأقل:

- `app.store.authorize`
- `app.uninstalled`
- `product.created`
- `product.updated`
- `product.deleted`
- `customer.created`
- `customer.updated`
- `order.created`
- `order.status.update`

توثيق سلة: [إنشاء تطبيق](https://docs.salla.dev/create-app) و [التفويض](https://docs.salla.dev/authorization).

### 3) أسرار تُنسخ من سلة إلى السيرفر

من بوابة الشركاء → مفاتيح التطبيق / الويب هوك:

```dotenv
SALLA_CLIENT_ID=
SALLA_CLIENT_SECRET=
SALLA_WEBHOOK_SECRET=
SALLA_WEBHOOK_URL=https://نطاقك.com/api/webhooks/salla
SALLA_API_URL=https://api.salla.dev
SALLA_TOKEN_URL=https://accounts.salla.sa/oauth2/token
```

### 4) أسرار تُولَّد عندك (ليست من سلة)

```bash
openssl rand -base64 32
```

```dotenv
SALLA_TOKEN_ENCRYPTION_KEY=  # الناتج من الأمر أعلاه — لتشفير توكنات سلة في قاعدة البيانات
APP_URL=https://نطاقك.com
```

لا تعتمد في الإنتاج على لصق `SALLA_ACCESS_TOKEN` يدويًا. بعد تثبيت التطبيق تُحفظ التوكنات مشفّرة في الجدول `salla_authorizations`.

### 5) ربط المتجر الحي بالتطبيق

1. أعد نشر التطبيق بعد حفظ المتغيرات.
2. من لوحة التحكم → **التكاملات** اضغط **ربط متجر سلة الحي**  
   أو افتح: `https://نطاقك.com/api/salla/install`
3. سجّل الدخول بحساب **التاجر الحي** ووافق على الصلاحيات.
4. تأكد من الحالة عبر: `https://نطاقك.com/api/salla/setup`  
   (يعرض الخطوات المتبقية دون إظهار قيم الأسرار).
5. من التكاملات: زامن المنتجات، وتأكد أن وضع الصيانة ما زال مغلقًا.

يمكنك نسخ رابط إعادة التوجيه ورابط الويب هوك من لوحة التكاملات داخل التطبيق.

---

## الجزء الثاني: الاشتراك في واتساب للأعمال (Cloud API)

التطبيق يستخدم **WhatsApp Cloud API** من ميتا (Graph API الإصدار 25)، وليس تطبيق واتساب للأعمال على الجوال وحده. التطبيق على الجوال لا يكفي لاستقبال الطلبات في هذا النظام.

### 1) حساب أعمال ميتا

1. أنشئ أو استخدم حساب [Meta Business Suite](https://business.facebook.com/).
2. أكمل بيانات النشاط التجاري.
3. للإنتاج الحقيقي (خارج أرقام الاختبار) غالبًا تحتاج **توثيق النشاط التجاري** (Business Verification) داخل ميتا.

### 2) تطبيق مطورين وإضافة واتساب

1. افتح [Meta for Developers](https://developers.facebook.com/).
2. أنشئ تطبيقًا من نوع **Business**.
3. أضف المنتج **WhatsApp**.
4. اربط التطبيق بحساب الأعمال وحساب **WhatsApp Business Account (WABA)**.

### 3) رقم واتساب للأعمال

1. من لوحة واتساب في تطبيق المطورين: أضف رقم هاتف.
2. أكّد الرقم برسالة SMS أو اتصال.
3. لا تستخدم رقمًا ما زال مسجّلًا على واتساب الشخصي إلا بعد نقله رسميًا إلى WhatsApp Business API.
4. أرسل اسم العرض (Display Name) للمراجعة وانتظر الموافقة.
5. انسخ **Phone number ID** (معرّف الرقم) وليس الرقم نفسه فقط.
6. انسخ **WhatsApp Business Account ID** إن طُلب في لوحة ميتا.

للتطوير يمكنك استخدام الرقم الاختباري الذي توفره ميتا مع قائمة أرقام مسموح لها بالاستلام. للإنتاج استخدم الرقم الحقيقي بعد الموافقة.

### 4) صلاحيات التوكن

أنشئ **توكن نظام (System User)** من Business Settings، أو توكن دائم من التطبيق، بصلاحيات على الأقل:

- `whatsapp_business_messaging`
- `whatsapp_business_management`

لا تستخدم توكن اختبار قصير العمر في الإنتاج.

### 5) توليد رمز التحقق للويب هوك عندك

هذا الرمز تختاره أنت وتضعه في ميتا وفي السيرفر بنفس القيمة:

```bash
openssl rand -hex 24
```

### 6) أسرار تُنسخ إلى السيرفر

```dotenv
WHATSAPP_PHONE_NUMBER_ID=          # من لوحة واتساب في تطبيق المطورين
WHATSAPP_BUSINESS_ACCOUNT_ID=     # معرّف حساب واتساب للأعمال
WHATSAPP_ACCESS_TOKEN=            # توكن النظام الدائم
WHATSAPP_VERIFY_TOKEN=            # الرمز الذي ولّدته في الخطوة 5
WHATSAPP_APP_SECRET=              # App Secret من إعدادات تطبيق ميتا (Settings → Basic)
```

`WHATSAPP_APP_SECRET` يُستخدم للتحقق من توقيع الويب هوك (`x-hub-signature-256`). لا تتركه فارغًا في الإنتاج.

### 7) الاشتراك في الويب هوك (Subscribe)

1. في تطبيق المطورين: WhatsApp → **Configuration** → Webhooks.
2. Callback URL:

```
https://نطاقك.com/api/webhooks/whatsapp
```

3. Verify token: نفس قيمة `WHATSAPP_VERIFY_TOKEN`.
4. اضغط Verify and save. يجب أن يرد التطبيق على طلب `GET` بنجاح.
5. اشترك في الحقل **messages** (رسائل الواردة).
6. اربط الويب هوك بحساب WABA الخاص بالمتجر (Subscribe to this object).

بدون خطوة الاشتراك هذه لن تصل رسائل العملاء إلى التطبيق حتى لو كان التوكن صحيحًا.

### 8) اختبار سريع بعد الربط

1. أرسل من رقم مسموح رسالة مثل: `منيو` أو `مرحبا`.
2. يجب أن يرد البوت برابط متجر سلة الحي.
3. يمكن للعميل كتابة الطلب نصًا ثم `نعم` للتأكيد؛ التطبيق يحفظ الطلب ويدفعه إلى سلة عند نجاح الربط.
4. راقب لوحة التحكم → المحادثات، وصفحة التكاملات.

إذا فشل التحقق من الويب هوك: تأكد أن `APP_URL` عام، وأن `WHATSAPP_VERIFY_TOKEN` مطابق حرفيًا، وأن التطبيق منشور بعد تحديث البيئة.

---

## ترتيب التشغيل الموصى به

1. نشر التطبيق + قاعدة البيانات + `APP_URL`.
2. إعداد متجر سلة الحي وإيقاف الصيانة.
3. تطبيق الشركاء + الأسرار + تثبيت OAuth.
4. حساب ميتا + رقم واتساب + الويب هوك.
5. اختبار رسالة واتساب ثم طلب يظهر في سلة.

---

## قائمة تحقق سريعة

**سلة**

- [ ] متجر حي منشور، ليست نسخة تجريبية
- [ ] الصيانة معطّلة
- [ ] `NEXT_PUBLIC_SALLA_STOREFRONT_URL` يشير للمتجر الحي
- [ ] Redirect وWebhook في بوابة الشركاء يطابقان النطاق العام
- [ ] `SALLA_CLIENT_ID` و`SALLA_CLIENT_SECRET` و`SALLA_WEBHOOK_SECRET`
- [ ] `SALLA_TOKEN_ENCRYPTION_KEY` مولَّد محليًا
- [ ] تم تثبيت التطبيق عبر `/api/salla/install`

**واتساب**

- [ ] تطبيق ميتا + منتج WhatsApp + WABA
- [ ] رقم معتمد وPhone number ID
- [ ] توكن دائم بصلاحيات المراسلة
- [ ] ويب هوك `.../api/webhooks/whatsapp` مشترك في `messages`
- [ ] `WHATSAPP_VERIFY_TOKEN` و`WHATSAPP_APP_SECRET` على السيرفر

---

## روابط داخل التطبيق بعد النشر

| الغرض | المسار |
|---|---|
| لوحة التحكم | `/dashboard` |
| التكاملات ونسخ روابط سلة | `/dashboard` ← التكاملات |
| تثبيت سلة | `/api/salla/install` |
| حالة إعداد سلة (بدون أسرار) | `/api/salla/setup` |
| ويب هوك سلة | `/api/webhooks/salla` |
| ويب هوك واتساب | `/api/webhooks/whatsapp` |
| تحويل القائمة إلى سلة | `/menu` |
