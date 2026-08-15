import { backend } from "./backend";

export async function setCollectionPinned(id: string, pinned: boolean) {
  await backend.collection("collections").update(id, { pinned });
}
