import { pb } from "./pocketbase";

export async function setCollectionPinned(id: string, pinned: boolean) {
  await pb.collection("collections").update(id, { pinned });
}
