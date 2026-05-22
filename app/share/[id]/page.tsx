import { ShareComments } from "@/components/share-comments"
import { ShareView } from "./share-view"

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <>
      <ShareView id={id} />
      <div className="bg-background px-4">
        <div className="mx-auto max-w-3xl">
          <hr className="my-8 border-border" />
          <ShareComments shareId={id} />
        </div>
      </div>
    </>
  )
}
