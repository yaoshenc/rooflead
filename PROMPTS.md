# How AI tools were used on RoofLead

This file records how AI tools were used to build RoofLead: what I asked for, what the AI produced, and the decisions I made along the way. The prompts are copied word for word from the session transcript, typos included, and nothing has been edited. Screenshots I attached are noted but not reproduced.

## Tools

| Tool | What it was used for |
|---|---|
| **Claude Code** (Anthropic's AI coding agent, run as a cloud session from the Claude app) | It read the codebase, wrote and changed the code, ran builds and automated browser tests, committed and pushed to this repo, and deployed to Cloudflare. It also answered questions and suggested features. |
| **"unslop"** design skill for Claude Code ([heydamir/unslop](https://github.com/heydamir/unslop), third party) | It was used for one interface pass, which I rejected and reverted (see 9 Nov, prompts 19–21). |
| **OpenAI ChatGPT "Sites"** | The starting codebase (commit `71ec35e`) was exported from a ChatGPT Site. The prompts used there are not part of this log. |
| **OpenAI API**, used *inside* the app at runtime | The app calls it for AI property research, roof outlines from satellite imagery, and turning dictated inspection notes into written recommendations (`lib/research.ts`, `lib/outline.ts`, `lib/assist.ts`). This is a product feature, not a development tool. |

## How I worked with it

- I gave direction in short prompts, often with a screenshot of what I wanted changed. On decisions that were mine to make, such as where to deploy, whether to pay for AI features, and design direction, Claude asked me multiple-choice questions before building.
- Claude wrote nearly all of the code. My part was:
  - choosing what to build, often from lists of suggestions I asked it for;
  - reviewing each result in the running app;
  - reporting bugs and visual problems with screenshots;
  - rejecting or reversing changes I didn't like.
- **Checks before each deploy:** Claude ran a production build, a dry-run deploy and scripted browser tests with Playwright at desktop and mobile sizes, and checked for page errors. It re-ran earlier tests to catch regressions. I then checked the live site myself.
- **Secrets:** API tokens and the app password were entered through secure credential forms or the Cloudflare dashboard, never typed in chat. None are in this repo.
- **Demo-only parts:**
  - Facebook/Messenger leads are simulated.
  - Card deposits run in a Stripe-style test mode, and no card numbers are stored.
  - Quote emails and texts are recorded and previewed, not actually delivered.
  - `docs/HOSTING.md` lists what real providers would be needed.

## Prompt log

Times are UTC. Links go to the commit that came out of the prompt.

### 9 November: deployment and core features

1. **11:39** · "help me deploy this website with everything working after that make improvements whatever you think is good"
   Claude checked that the app built and ran, then asked two questions. I answered **"Own Cloudflare"** (instead of the original ChatGPT Site) and **"Yes, I'll provide a key"** for the paid OpenAI features. Result: a password-gated Cloudflare Workers deployment with a D1 database ([8132514](https://github.com/yaoshenc/rooflead/commit/8132514), [1b38515](https://github.com/yaoshenc/rooflead/commit/1b38515)), plus workspace backup/restore and safer saving ([1a687a7](https://github.com/yaoshenc/rooflead/commit/1a687a7)).
2. **11:45** · "how do i create an api key"
   Step-by-step instructions for the keys the deploy needed: fixing the Cloudflare API token, which could manage Workers but not the database, and creating an OpenAI API key. No code.
3. **11:56** · "when i go workers page it opening does not create a free subdomain"
   Claude checked through Cloudflare's API and found the free workers.dev subdomain had been created; the dashboard just wasn't showing it. No code.
4. **12:09** · "ive createrd a new token"
   The first token lacked database permission. With the new one, the deploy and database setup completed.
5. **12:21** · "ive chagned the app_password"
   The password had been saved as plain text and was too short, so I re-added it as a secret of at least 8 characters. Claude also stopped deploys from wiping variables set in the dashboard ([4ce092b](https://github.com/yaoshenc/rooflead/commit/4ce092b)).
6. **12:24** · "now it works"
7. **12:27** · "i want you to improve the app. make the aerial estimation more flushed out and make it work showing estimation of satellite view. also i want features such as facebook leads with automated replies"
   Result: an aerial roof take-off with a measured satellite view ([4070051](https://github.com/yaoshenc/rooflead/commit/4070051)), and Facebook Lead Ads / Messenger leads with automated replies ([d3b415c](https://github.com/yaoshenc/rooflead/commit/d3b415c)).
8. **12:43** · Feature list (verbatim):
   ````text
   For facebook or meta just simulate dont actually add api keys.

   and add these features

   1. Customer photos and defect records
   - Add photo uploads to the customer’s job form.
   - Let the roofer label photos by location and defect, such as “Rear gutter — cracked tile.”
   - Link photos to inspection findings and quote items.

   3. Quote templates and price book
   - Add reusable templates for common jobs such as leak repairs, roof replacements and gutter work.
   - Store labour and material rates in AUD, with units and a last-updated date.
   - Let the roofer apply a template to a job and adjust quantities and rates before saving.
   ````
   Result: job photos with defect findings, a price book and quote templates, and a simulated Facebook feed ([1280183](https://github.com/yaoshenc/rooflead/commit/1280183)). My decision: simulate Facebook rather than connect real Meta API keys.
9. **12:47** · "i want to demo this product so please do not say anything simulate but work as if it would in production"
   All interface wording was changed to production language ([9b3247b](https://github.com/yaoshenc/rooflead/commit/9b3247b)).
10. **12:58** · *(Action, not a prompt.)* I opened pull request [yaoshenc/rooflead#1](https://github.com/yaoshenc/rooflead/pull/1) from the Claude Code app.
11. **13:01** · "add more demo data. how come satlettie view does not show on some of the quotes"
    Result: example jobs on real NSW addresses, and the aerial view shown on quotes ([1d16c62](https://github.com/yaoshenc/rooflead/commit/1d16c62)).
12. **13:33** · "for the information request for email and email do autmoation like message format for easier readability. make roofers save time instead of texting"
    Result: automated information requests to customers, with a formatted email/SMS and an online answer form ([3df8da6](https://github.com/yaoshenc/rooflead/commit/3df8da6)).
13. **13:39** · [screenshot] "redesign this to be more seamless"
    The lead/quote trail was replaced with a single job progress bar ([9bffed1](https://github.com/yaoshenc/rooflead/commit/9bffed1)).
14. **13:45** · "help redesign the whole ui to have visual improvements and increase usablability"
    An interface refresh with search, keyboard shortcuts, mobile navigation and tabbed settings ([2f72894](https://github.com/yaoshenc/rooflead/commit/2f72894)).
15. **13:59** · [screenshot] "there's a bug with this being sticky"
    Fixed the sticky section navigation ([cca16a4](https://github.com/yaoshenc/rooflead/commit/cca16a4)).
16. **14:02** · [screenshot] "make this look less clustered"
    Decluttered the follow-ups card ([a662b26](https://github.com/yaoshenc/rooflead/commit/a662b26)).
17. **14:04** · "git clone https://github.com/heydamir/unslop / mkdir -p ~/.claude/skills && cp -r unslop/skills/unslop ~/.claude/skills/ / add this skill"
    Claude installed the third-party design skill into the session.
18. **14:06** · "first for the customer up follow system have and messengers. make it more friendly with how it is organised within the app. make it easier to have of these feauters along side the ai property report"
    Customer conversation, details and follow-ups were brought into one panel beside the property report ([83aa572](https://github.com/yaoshenc/rooflead/commit/83aa572)).
19. **14:12** · "/unslop help me make the whole app look way better"
    Claude proposed a design direction and asked me about it. I chose **"Go further"**, **"Use business details"** in the sidebar, and real counts on the dashboard ([d9f4e0a](https://github.com/yaoshenc/rooflead/commit/d9f4e0a)).
20. **14:23** · "have a feature where the you can view the customers information, if they have multiple projects and also find more information about them"
    Result: a customer directory and profiles that group a customer's projects ([6095ed2](https://github.com/yaoshenc/rooflead/commit/6095ed2)).
21. **14:28** · "the unslop looks worst than before reverse the ui and do what it was before"
    **I rejected the AI redesign.** It was reverted, and the customer directory was kept ([5f820c9](https://github.com/yaoshenc/rooflead/commit/5f820c9)).

### 9–10 November: choosing and building features for roofers

22. **23:43** · "What are some potential improvements that you suggest or other features that could help roofless save time and potentially money?"
    Claude suggested a list of features. No code.
23. **23:46** · My selection from that list (verbatim):
    ````text
    4.	Customers accept quotes and pay deposits online. Send a link; they review it, sign and pay a deposit by card (via Stripe). Less chasing, and the job is locked in before a competitor calls back. (Make a demo for this don’t have to use a functional app as long as it looks like it works)

    	5.	Automatic quote follow-ups. Reuse the reminder engine you already have to send a nudge at day 3 and day 7 ("Any questions about your quote?"). Many roofing quotes are lost simply to silence.

    7.	Invoice reminders and payment tracking. Overdue reminders go out automatically, and you can mark an invoice paid with the date.

    9.	On-site inspection mode for mobile. A checklist per job type, photos taken straight into labelled findings, and a voice note turned into a written recommendation. It should work without signal and sync later.
    ````
    Result: a customer quote link with signature and test-mode card deposit, day 3 / day 7 follow-ups, invoice reminders and payment tracking, and an offline inspection mode ([78b19d8](https://github.com/yaoshenc/rooflead/commit/78b19d8)).
24. **10 Nov 00:57** · "What other features do you think should be improved"
    Suggestions only. No code.
25. **01:04** · "What other improvements do you recommend that would help roofers or the current app"
    Suggestions only. No code.
26. **01:52** · My selection (verbatim):
    ````text
    Crew and subcontractor assignment. Assign each job to a crew, send them a job sheet (address, access notes, gate code from customer notes, roof measurements, findings and photos), and let them tick off tasks on their phone. This reuses the offline inspection mode.
    	•	Daily weather check. Use the Bureau of Meteorology forecast for each scheduled job (rain, wind over about 40 km/h, extreme heat). It flags "reschedule?" a day ahead and drafts the message to the customer.

    Add this feature
    ````
    Result: crews, scheduling, crew job sheets and a weather check ([295996e](https://github.com/yaoshenc/rooflead/commit/295996e)). Claude flagged that the Bureau of Meteorology's website data isn't licensed for reuse and used Open-Meteo instead. I accepted that change.
27. **02:04** · "Have an automated customer feature for sending the quotes via email and text (don’t have to actually attach to email but it demo feature)"
    Result: quote sending by email and SMS with previews, a PDF attachment and a Messages page listing everything sent ([94344bd](https://github.com/yaoshenc/rooflead/commit/94344bd)).
28. **02:15** · "I feel there’s a lot of clutter throughout the whole remove some of the scheduling feature and keep the whole app lore organised. Make all relevant information and feature in the same place. Have collapsible tabs when needed. Save roofers time with quotations is the main goal."
    The Schedule page was removed from navigation, lead and quote pages got collapsible cards, and sending, the customer link and follow-ups were merged into one card ([ac3f76a](https://github.com/yaoshenc/rooflead/commit/ac3f76a)). My decision: make quoting the main focus of the product.

### 11 November: polish from testing the live app

29. **07:12** · [screenshot] "there's an issue with going down the page with this. the customer info doesn"
    Fixed the customer panel being cut off while scrolling ([7468552](https://github.com/yaoshenc/rooflead/commit/7468552)).
30. **07:16** · "how do i make the roof estimation more accurate. do i need a better gpt model?"
    Advice only. Roof pitch, which an aerial photo can't show, is the largest source of error, so a bigger model alone wouldn't fix it. Options included entering pitch on site, using LiDAR elevation data, adjusting outlines by hand, and re-running only low-confidence outlines with the larger model. No code yet.
31. **07:17** · [screenshot] "make the tabs look a bit better"
    The inspection tabs were restyled ([8f6d2d5](https://github.com/yaoshenc/rooflead/commit/8f6d2d5)).
32. **07:34** · [screenshot] "make the ui for these pop ups wider so i can see more information"
    Wider message popups, with the email and SMS side by side ([e985b76](https://github.com/yaoshenc/rooflead/commit/e985b76)).
33. **07:42** · [2 screenshots] "instead of sent automatically have an option to confirm before sending and an option to send again. remove the 2 ticks."
    Quotes now need confirmation before sending, with a Send again option, and the two review checkboxes were removed ([8b2ae18](https://github.com/yaoshenc/rooflead/commit/8b2ae18)). Testing also found and fixed a date bug ("Viewed online 1 Jan"). My decision: reverse the AI's earlier automatic-sending default, so the roofer stays in control of what customers receive.
34. **09:13** · "i think the ui is a bit bland. is it possible to add potentially one more colour to make brigthen it without making it too overwhelming"
    One amber accent colour was added, used only for small highlights ([88e2489](https://github.com/yaoshenc/rooflead/commit/88e2489)).

### Other AI use in the same session

35. **11 Nov 09:44** · [screenshot of the weekly reflection form] "help me fill this form out"
    Claude drafted answers from the commit history. It said the form should declare the use of an AI coding assistant, and left the questions about team decisions and acknowledging a teammate for me to answer myself.
36. **15 Nov 13:19** · [screenshot of the requirement "Put your PROMPTS.md in the repo so we can see how you used AI tools."] "add this requirement for the project"
    Claude wrote this file from the session transcript and the git history.
