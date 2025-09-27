<script lang="ts">
  import { db } from "$lib/firebase";
  import { collection, addDoc, getDocs } from "firebase/firestore";
  import type { DocumentData } from "firebase/firestore"; // ✅ type-only import

  let message: string = "Testing Firebase...";

  async function testConnection() {
    try {
      // Add a test document
      await addDoc(collection(db, "testCollection"), {
        createdAt: new Date(),
        message: "Hello from SvelteKit!"
      });

      // Define docs as an array of Firestore documents
      let docs: DocumentData[] = [];
      const querySnapshot = await getDocs(collection(db, "testCollection"));

      querySnapshot.forEach((doc) => {
        docs.push(doc.data());
      });

      message = "✅ Firebase connected! Documents: " + JSON.stringify(docs);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message = "❌ Firebase error: " + error.message;
      } else {
        message = "❌ Unknown Firebase error";
      }
    }
  }

  testConnection();
</script>

<h1>{message}</h1>
