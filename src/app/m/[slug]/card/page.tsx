import { notFound } from "next/navigation";
import { repo } from "@/lib/repo";
import CardCreator from "./CardCreator";

export default async function CardCreatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const maker = await repo.getMakerBySlug(slug);
  if (!maker) notFound();

  return (
    <CardCreator
      makerId={maker.id}
      fromSlug={maker.slug}
      fromName={maker.name}
      photos={maker.photos}
    />
  );
}
