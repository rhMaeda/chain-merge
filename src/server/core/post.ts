import { context, reddit } from '@devvit/web/server';
import { PINNED_COMMENT_TEXT } from '../../shared/content';

const toPostThingId = (postId: string): `t3_${string}` =>
  (postId.startsWith('t3_') ? postId : `t3_${postId}`) as `t3_${string}`;

export const toPostPermalinkId = (postId: string): string =>
  postId.startsWith('t3_') ? postId.slice(3) : postId;

export const createPost = async () => {
  const { subredditName } = context;
  if (!subredditName) {
    throw new Error('subredditName was not found in context.');
  }

  const post = await reddit.submitCustomPost({
    title: 'Chain Merge',
    subredditName,
    entry: 'default',
    userGeneratedContent: {
      text: 'Build ascending chains, chase combos, and check the stickied comment for the rules.',
    },
  });

  try {
    const instructionsComment = await reddit.submitComment({
      id: toPostThingId(post.id),
      text: PINNED_COMMENT_TEXT,
      runAs: 'APP',
    });
    await instructionsComment.approve();
    await instructionsComment.distinguish(true);
  } catch (error) {
    console.error('Could not create or sticky the instructions comment.', error);
  }

  return post;
};
