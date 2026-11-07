<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/hero-en-dark.webp">
    <img src="docs/assets/hero-en-light.webp" alt="Media Desk: from one idea to a finished post" width="100%">
  </picture>
</p>

<h1 align="center">Media Desk</h1>

<p align="center"><b>A DeepSeek Harness plugin. Capture an idea, and one click drafts the script, cover, images and storyboard.</b></p>

<p align="center">An English-only edition for Instagram, X and Reddit.</p>

<p align="center">
  <a href="#get-started">Install</a> ·
  <a href="#what-it-costs">What it costs</a> ·
  <a href="#faq">FAQ</a>
</p>

<p align="center">
  <img alt="DeepSeek Harness 0.2.x" src="https://img.shields.io/badge/DeepSeek%20Harness-0.2.x-111?style=flat-square">
  <img alt="Mac desktop and web" src="https://img.shields.io/badge/Mac%20desktop-web-111?style=flat-square">
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/MIT-open%20source-111?style=flat-square"></a>
  <a href="https://github.com/DSH-Extensions-list/dsh-media-desk/stargazers"><img alt="Star" src="https://img.shields.io/github/stars/DSH-Extensions-list/dsh-media-desk?style=flat-square&color=111&label=Star"></a>
</p>

<br>

## What it is

Media Desk is a page in the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) sidebar. It opens on a wall of your ideas, one line each. Open one, click **Draft it**, and you get a spoken script, a title, a video cover, images and a six-frame storyboard. Ask for changes in the chat on the left and the draft updates on the right. Then drag the finished piece onto the calendar, publish it, and come back for the numbers.

There are five pages: **Ideas · Content · Schedule · Insights · Styles**. The interface is in English, and the scripts, titles and storyboards it writes are in English too. There is no language setting: this edition is English-only. The web version also works in a phone browser.

It works with Instagram, X and Reddit.

<br>

## Draft it in one click

<table>
<tr>
<td width="62%">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/f-studio-en-dark.webp">
    <img src="docs/assets/f-studio-en-light.webp" width="100%" alt="The studio: chat on the left; title, cover, script and a six-frame storyboard on the right">
  </picture>
</td>
<td valign="top">
<p><b>Everything fills in together.</b></p>
<p>The layout appears as soon as you open an idea. The title, script, cover, images and six storyboard frames are generated in parallel and appear as each one is ready.</p>
<p><b>Ask for a change.</b></p>
<p>Try "make it clearer", "shoot frame 3 from above" or "bolder cover text". The draft updates as you watch, and every change can be undone.</p>
<p><b>Take it with you.</b></p>
<p>Edit the script in place, copy it, or save the whole piece (cover, images and frames) to one folder.</p>
</td>
</tr>
</table>

<br>

## The idea wall

<table>
<tr>
<td valign="top" width="38%">
<p><b>One line, one idea.</b></p>
<p>Text, links, images, videos and quotes all become cards. Spread them out on an infinite canvas, or switch to a feed sorted by date.</p>
<p><b>Related ideas come to you.</b></p>
<p>Type "agent" and press Enter. Your new idea is saved, and every earlier idea that mentions agents moves next to it, sorted by relevance.</p>
<p><b>An assistant on the side.</b></p>
<p>"Write up today's best idea", "What's coming up?", "From now on, keep titles under 10 words". Ask in a sentence and it's done.</p>
</td>
<td>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/f-home-en-dark.webp">
    <img src="docs/assets/f-home-en-light.webp" width="100%" alt="The idea wall as a freeform canvas with the assistant open, and as a feed">
  </picture>
</td>
</tr>
</table>

<br>

## Schedule

<table>
<tr>
<td width="62%">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/f-schedule-en-dark.webp">
    <img src="docs/assets/f-schedule-en-light.webp" width="100%" alt="The schedule calendar with the next post and the list of unscheduled pieces">
  </picture>
</td>
<td valign="top">
<p><b>One calendar for ideas and posts.</b></p>
<p>Each day you capture an idea gets a stamp, so you can see your streak. Drag a finished piece from the side list onto a day to schedule it.</p>
<p>Your next post is always pinned in the top right.</p>
</td>
</tr>
</table>

<br>

## Insights

<table>
<tr>
<td valign="top" width="38%">
<p><b>See what worked, and keep doing it.</b></p>
<p>Enter numbers by hand, paste a CSV, or import your own account. You'll see daily views, a breakdown by platform and your top pieces in one place.</p>
<p>Turn a suggestion into a writing rule with one click and it applies to everything you write next. Rules can be exported as a DeepSeek Harness skill.</p>
</td>
<td>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/f-insights-en-dark.webp">
    <img src="docs/assets/f-insights-en-light.webp" width="100%" alt="Insights: a one-line summary, daily views, views by platform, top pieces and suggestions">
  </picture>
</td>
</tr>
</table>

<br>

## Styles

<table>
<tr>
<td width="62%">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/f-style-en-dark.webp">
    <img src="docs/assets/f-style-en-light.webp" width="100%" alt="Style presets grouped by category, and the content board">
  </picture>
</td>
<td valign="top">
<p><b>Pick a voice.</b></p>
<p>Fifteen creator presets in eight categories: tech, travel and food, lifestyle, opinion, tutorials, reviews, stories and news. Pick one and start writing.</p>
<p><b>Or use your own.</b></p>
<p>Import an account or a subreddit, or paste a few of your posts, and Media Desk extracts your style into an editable card.</p>
<p>The content board shows where every piece stands: idea, outline, draft, ready or published.</p>
</td>
</tr>
</table>

<br>

<a id="get-started"></a>
## Get started

Requires DeepSeek Harness `0.2.1-rc.5` or later in the `0.2.x` line. Tested on `0.2.2-rc.1`, desktop and web.

**1. Install.** Copy this release URL into **Plugins → Add plugin** in DeepSeek Harness.

```text
https://github.com/DSH-Extensions-list/dsh-media-desk/releases/download/v3.2.0/dsh-media-desk-3.2.0.tgz
```

You can also download the archive and enter its absolute `file:` path in the same dialog. For a self-managed web profile, install it from the directory where you downloaded the archive and restart `dsh web`.

```bash
dsh plugin --profile web add "file:$PWD/dsh-media-desk-3.2.0.tgz"
```

**2. Update.** Install the archive for the newer version from [Releases](https://github.com/DSH-Extensions-list/dsh-media-desk/releases).

**3. Open.** **Media Desk** appears in the sidebar. On first launch it's filled with sample data so you can explore every page. Click **Clear sample data** in the top right when you're ready to start with your own.

To uninstall, remove Media Desk from the Plugins page. For the web profile, run `dsh plugin --profile web remove dsh-media-desk`. Your content stays in `~/.dsh/media-desk/`.

<br>

<a id="what-it-costs"></a>
## What it costs

The plugin is free and ships with no API keys. Anything that uses a model runs on your own accounts.

| | What it uses | Without it |
| --- | --- | --- |
| **Script** | The model you've set up in DeepSeek Harness | A structural outline only |
| **Cover, images, storyboard** | Your own image API key, added in the plugin settings | Script and storyboard text still work, and the cover is made from text |
| **Account import** (optional) | An Instagram access token for your professional account. X uses public profile data and Reddit uses its JSON API or public feed. | Enter numbers by hand, or paste posts to learn a style |

Images work with any service compatible with the OpenAI Images API (`POST {endpoint}/images/generations`). GPT Image 2.6 Sunburst and Flare are available as OpenAI presets. They require an OpenAI API key and API billing. xAI, Volcengine Ark, Zhipu, SiliconFlow and custom endpoints are also supported. Click **Generate test image** to check that it works. Each draft makes 9 images by default, and you can change that. With a GPT Image 2.6 preset, choose **Animated GIF** in Settings to generate looping covers, figures and storyboard frames. Set 2–16 frames and the duration per frame. Draft exports include the original GIFs alongside any composited still video cover. Your key is stored only in the local `settings.json` (file mode 600). It never goes into your content data and is never sent to the text model.

<br>

## Draft for a brand or yourself

Open an idea in Studio and choose **Publish as**. Select **Brand** and enter the name, or select **Personal** for your own voice. Choose **Post**, **Post + image**, or **Video**, then pick a writing style or leave it neutral. Studio saves the brief on the idea. Chat can draft the open idea or one you name by title.

## Import your own account

Open **Sources** from the toolbar, or choose **Import account** in Styles or Insights. Paste a profile URL or copied share link. If you only have a handle, choose Instagram or X first. Reddit also accepts `r/community` and `u/username`. Choose **Link and import**. Imported posts appear in Content. **Import now** refreshes a saved source on demand. Auto-refresh runs roughly every eight hours while DeepSeek Harness is open, and can be turned off per account. Failed refreshes leave existing posts in place. Disconnecting stops refreshes and removes the saved token while keeping imported content.

- **Instagram:** In your [Meta app](https://developers.facebook.com/apps/), add Instagram API with Instagram Login and generate an access token for your Business or Creator account with `instagram_business_basic`. The setup button can open the dashboard in the DSH Sidebar Browser. Follow the steps in Sources and paste the token into the local form. Media Desk verifies the token's account and stores it only on the local host. Replace the token when it expires.
- **X:** Enter an `x.com/<handle>` profile. Media Desk reads the recent original posts X makes available on the public profile. Login screens or rate limits can interrupt refreshes.
- **Reddit:** Enter a profile (`reddit.com/user/<name>` or `/u/<name>`) or a subreddit (`reddit.com/r/<name>`). Media Desk tries JSON first, then the public Atom feed. Reddit profile scores and comment counts reach Insights when JSON is available. Community posts keep their authors and stay out of account metrics.

For an individual post, article or other web page, use **Sources → Save a link**. It saves a bookmark to Ideas, so the link works even if the site requires a login to read the page. You can give it your own title.

<br>

<a id="faq"></a>
## FAQ

<details>
<summary><b>Can I import someone else's account?</b></summary>
<br>

Instagram requires authorization from the account. X and Reddit can import recent public posts. You can also paste content or public links to learn a style.

</details>

<details>
<summary><b>Can it post for me?</b></summary>
<br>

No. Platforms don't offer a common publishing API, so copy the script or save the folder and post it yourself. Saved folders go to `~/Documents/Media Desk/` by default and include the script, storyboard, cover, images and frames.

</details>

<details>
<summary><b>Where is my data?</b></summary>
<br>

Everything stays on your computer in `~/.dsh/media-desk/`, shared by the desktop and web versions. No cloud and no sign-up.

</details>

<details>
<summary><b>Does it work without an image model?</b></summary>
<br>

Yes. The script, title and storyboard text are written as usual, and the cover is made from the cover text. Connect an image model to draw the cover, images and frames too.

</details>

<details>
<summary><b>Is this made by DeepSeek?</b></summary>
<br>

No. It's a community plugin. Scripts are written by the model you've set up in DeepSeek Harness and billed to your own account.

</details>

<br>

## About this edition

This is the English-only edition of Media Desk, with three platforms: Instagram, X and Reddit. It is maintained at [DSH-Extensions-list/dsh-media-desk](https://github.com/DSH-Extensions-list/dsh-media-desk). Issues and ideas are welcome on [GitHub](https://github.com/DSH-Extensions-list/dsh-media-desk/issues).

## Thanks

- The [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) team, for an open plugin system to build on.
- [dsh-Go](https://github.com/ccch1mneyyy/dsh-Go), whose README layout inspired this one.
- The original [Media Desk](https://github.com/woniuniuniu/dsh-media-desk) by Snail's Tech Notes, from which this English-only edition is derived under the MIT license.

## Development

```bash
npm install && npm test        # host logic tests
npm run watch                  # rebuild when client/ changes
scripts/dev-sandbox.sh         # run the web version in an isolated DSH_HOME
node scripts/mock-llm.mjs      # mock text and image models, no quota used
npm pack                       # build the installable tgz
```


| Path | Contents |
| --- | --- |
| `client/` | UI: idea wall, studio, chat, content, schedule, insights, styles, settings |
| `src/` | Host routes, drafting pipeline, prompts, image generation, style learning, social imports, local storage |
| `scripts/` | Bundling, sandbox, mock models, sample asset generation |
| `assets/` | Sample images and videos, all generated by `scripts/gen-assets.py` |
| `docs/assets/` | The images on this page |

Restart DeepSeek Harness after changing `src/`.

**Upgrading from the Chinese 2.x releases:** content written by those releases is not migrated or translated. An existing `state.json` is loaded rather than replaced, so old Chinese text and platform values remain. Anyone moving from those releases should use a clean or separate data directory, or keep using [upstream](https://github.com/woniuniuniu/dsh-media-desk). There is no automatic reset.

**Security:** Every route is authenticated by the host. Model output and fetched content are reduced to known fields with length limits, and only allow-listed operations run. Pasted links can't reach localhost or private networks. Account URLs are validated and access tokens stay out of browser responses. Please report vulnerabilities privately through [Security Advisories](https://github.com/DSH-Extensions-list/dsh-media-desk/security/advisories/new).

<br>

<p align="center"><sub><a href="LICENSE">MIT</a> · A community plugin, not affiliated with DeepSeek. DeepSeek Harness and its marks belong to their respective owners.</sub></p>
