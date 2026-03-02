# check-browser

Use Real Browser MCP to check what's currently showing in my browser.

## Steps

1. Call `browser_snapshot` to see the current page structure
2. Based on what you find, take a `browser_screenshot` if visual verification is needed
3. Report back what you see - page title, key elements, any errors or unexpected state
4. If I asked you to verify something specific, focus on that

## When to use

- After making a code change, to verify it rendered correctly
- To check if a form works, a button does what it should, or content loaded
- To read page content I'm looking at
- To debug visual issues or check responsive layout

## Important

- This is my REAL browser. I'm already logged in everywhere.
- Don't close tabs I didn't ask you to close
- Don't navigate away from the current page unless I ask you to
- Use element refs from snapshots for any interactions
