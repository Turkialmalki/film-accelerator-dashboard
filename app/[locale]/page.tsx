import { redirect } from 'next/navigation';

/**
 * The locale root has no landing page of its own. Middleware has already sent
 * a signed-in visitor to their workspace, so anyone arriving here is
 * anonymous and belongs at sign-in.
 */
export default function LocaleIndex({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/sign-in`);
}
