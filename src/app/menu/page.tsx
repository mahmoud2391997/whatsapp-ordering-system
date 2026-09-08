import { redirect } from 'next/navigation';

export default function MenuPage() {
  const storefrontUrl = process.env.NEXT_PUBLIC_SALLA_STOREFRONT_URL;

  if (storefrontUrl) {
    redirect(storefrontUrl);
  }

  redirect('/dashboard');
}
