import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { createPost, toPostPermalinkId } from '../core/post';

export const menu = new Hono();

menu.post('/post-create', async (c) => {
  try {
    const post = await createPost();
    return c.json<UiResponse>({
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${toPostPermalinkId(post.id)}`,
    });
  } catch (error) {
    console.error('Could not create the Chain Merge post.', error);
    return c.json<UiResponse>(
      {
        showToast: 'Could not create the Chain Merge post.',
      },
      400,
    );
  }
});
