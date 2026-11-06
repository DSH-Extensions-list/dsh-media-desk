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
  <a href="https://github.com/arzvaak/dsh-media-desk/stargazers"><img alt="Star" src="https://img.shields.io/github/stars/arzvaak/dsh-media-desk?style=flat-square&color=111&label=Star"></a>
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

**1. Install.** In the DeepSeek Harness desktop app, go to Plugins → Add plugin, enter `dsh-media-desk`, and install.

You can also install from the command line. Quit the desktop app completely (⌘Q) first and reopen it afterwards. For the web version, restart `dsh web`. If the `dsh` command isn't available in your terminal, choose "Manage dsh command" from the desktop app's menu.

```bash
dsh plugin --profile desktop add dsh-media-desk
```

```bash
dsh plugin --profile web add dsh-media-desk
```

**2. Update.** When a new version comes out, update it on the Plugins page or run the same command again. To install offline, download `dsh-media-desk-*.tgz` from [Releases](https://github.com/arzvaak/dsh-media-desk/releases/latest) and use `"file:$PWD/dsh-media-desk-VERSION.tgz"` in place of the package name.

**3. Open.** **Media Desk** appears in the sidebar. On first launch it's filled with sample data so you can explore every page. Click **Clear sample data** in the top right when you're ready to start with your own.

To uninstall, replace `add` with `remove`. Your content stays in `~/.dsh/media-desk/`.

<br>

<a id="what-it-costs"></a>
## What it costs

The plugin is free and ships with no API keys. Anything that uses a model runs on your own accounts.

| | What it uses | Without it |
| --- | --- | --- |
| **Script** | The model you've set up in DeepSeek Harness | A structural outline only |
| **Cover, images, storyboard** | Your own image API key, added in the plugin settings | Script and storyboard text still work, and the cover is made from text |
| **Account import** (optional) | Monid for Instagram and X, a third-party data service billed per request (under a cent per account). Reddit import is free: it tries Reddit's JSON API first and falls back to the public Atom feed | Enter numbers by hand, or paste posts to learn a style |

Images work with any service compatible with the OpenAI Images API (`POST {endpoint}/images/generations`). OpenAI, xAI, Volcengine Ark, Zhipu and SiliconFlow come pre-filled, or you can add a custom endpoint. Click **Generate test image** to check that it works. Each draft makes 9 images by default, and you can change that. Your key is stored only in the local `settings.json` (file mode 600). It never goes into your content data and is never sent to the text model.

<br>

## Import your own account

In Styles or Insights, click **Import account** and paste a profile or subreddit link. Supported: Instagram, X and Reddit. Imported posts go into Content and Media Desk learns your style from them. Instagram and X imports also bring their engagement numbers into Insights. Importing again adds only new posts and refreshes the numbers.

**Reddit is free, and takes two kinds of link.** A profile link (`reddit.com/user/<name>`, or the short `/u/<name>`) brings that account's own posts. A subreddit link (`reddit.com/r/<name>`) brings that community's recent posts, and each post keeps its author, so community posts are never shown as yours. Media Desk asks Reddit's JSON API first, which carries scores and comment counts; when Reddit refuses it (it blocks datacentre IPs and rate-limits bursts), the import falls back to the public Atom feed, which carries titles, dates and links but no scores. You get whichever one Reddit serves. Numbers missing from the feed are entered by hand or pasted as CSV. A profile import that reaches the JSON API writes its scores and comment counts into Insights; a subreddit's scores belong to its posters, so they are not counted as the account's engagement. No API key and no third-party service either way.

**Instagram and X use Monid.** These imports are for an organisation or creator account, not a personal profile. Both are public profiles, so the same import works. The first time, connect [Monid](https://monid.ai) in three steps:

1. In a new DeepSeek Harness session, send `set up https://monid.ai/SKILL.md`. It installs the Monid command-line tool.
2. Sign up at [app.monid.ai](https://app.monid.ai/access/api-keys) and create an API key.
3. In your terminal, run `monid keys add -k YOUR_KEY -l main`. Don't paste the key into a chat.

The plugin only runs the local `monid` command and never sees your key. A Reddit import never calls Monid.

<br>

<a id="faq"></a>
## FAQ

<details>
<summary><b>Can I import someone else's account?</b></summary>
<br>

Import only accounts you own. Instagram and X profile links are sent to Monid and its data providers, so check that this fits your platform's terms. Reddit links are read from Reddit itself: the JSON API when it is reachable, the public Atom feed otherwise. A subreddit import reads a community's public posts, with each post's author kept. Only public data is available, and the feed carries no view, like or follower counts, so numbers missing from it stay manual. You can still paste content or public links to learn a style.

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

This is the English-only edition of Media Desk, with three platforms: Instagram, X and Reddit. It is maintained at [arzvaak/dsh-media-desk](https://github.com/arzvaak/dsh-media-desk). Issues and ideas are welcome on [GitHub](https://github.com/arzvaak/dsh-media-desk/issues).

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

`scripts/mock-monid.mjs` is a fake `monid` command that returns made-up content, so you can test the Instagram and X import flow for free. Wrap it as an executable named `monid` and put it first on your `PATH`. Reddit import needs no mock: it tries Reddit's JSON API, then the public feed.

| Path | Contents |
| --- | --- |
| `client/` | UI: idea wall, studio, chat, content, schedule, insights, styles, settings |
| `src/` | Host routes, drafting pipeline, prompts, image generation, style learning, Monid and Reddit import, local storage |
| `scripts/` | Bundling, sandbox, mock models, sample asset generation |
| `assets/` | Sample images and videos, all generated by `scripts/gen-assets.py` |
| `docs/assets/` | The images on this page |

Restart DeepSeek Harness after changing `src/`.

**Upgrading from the Chinese 2.x releases:** content written by those releases is not migrated or translated. An existing `state.json` is loaded rather than replaced, so old Chinese text and platform values remain. Anyone moving from those releases should use a clean or separate data directory, or keep using [upstream](https://github.com/woniuniuniu/dsh-media-desk). There is no automatic reset.

**Security:** Every route is authenticated by the host. Model output and fetched content are reduced to known fields with length limits, and only allow-listed operations run. Pasted links can't reach localhost or private networks. `monid` runs without a shell, and account IDs must match fixed formats. Please report vulnerabilities privately through [Security Advisories](https://github.com/arzvaak/dsh-media-desk/security/advisories/new).

<br>

<p align="center"><sub><a href="LICENSE">MIT</a> · A community plugin, not affiliated with DeepSeek. DeepSeek Harness and its marks belong to their respective owners.</sub></p>
