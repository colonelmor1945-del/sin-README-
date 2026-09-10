import type { MetadataRoute } from "next";

/**
 * The web app manifest.
 *
 * This is what makes the site installable, and it is also the file Bubblewrap
 * reads when it generates the Play Store wrapper, so the values here end up as
 * the Android app's name, icon and splash screen. Getting them wrong here means
 * getting them wrong in the store listing.
 *
 * `start_url` is the landing page rather than the dashboard on purpose. Someone
 * opening the installed app may not be signed in, and starting them on a route
 * that immediately redirects to /login is a worse first launch than starting
 * them somewhere that works either way.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GTA 6 Money Lab",
    // Android gives roughly 12 characters under the icon before it truncates.
    short_name: "Money Lab",
    description:
      "An independent AI intelligence platform for GTA 6 players. Plan money strategies, compare missions by real hourly rate and track asset payback periods. Not affiliated with Rockstar Games or Take-Two Interactive.",
    start_url: "/",
    id: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Matches --color-ground, so the splash screen and the app are the same
    // colour and there is no flash of white on launch.
    background_color: "#08060d",
    theme_color: "#08060d",
    categories: ["entertainment", "games", "utilities"],
    lang: "en",
    dir: "ltr",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android masks icons to the launcher's shape. Without a maskable
      // variant the mark gets cropped, or gets shrunk into a white box.
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Money plan",
        short_name: "Plan",
        url: "/dashboard/plan",
        description: "An ordered route from your balance to your goal",
      },
      {
        name: "Mission intelligence",
        short_name: "Missions",
        url: "/dashboard/missions",
        description: "Missions ranked by risk-adjusted hourly rate",
      },
      {
        name: "Economy tracker",
        short_name: "Economy",
        url: "/dashboard/economy",
        description: "Assets ranked by payback period",
      },
    ],
  };
}
