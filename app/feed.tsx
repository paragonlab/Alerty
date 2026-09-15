import { Redirect } from "expo-router";

// La lista se llamaba /feed; los enlaces viejos siguen llevando a Pulsos.
export default function FeedRedirect() {
  return <Redirect href="/(tabs)/pulsos" />;
}
