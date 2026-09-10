import { pgTable, text, serial, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const twitterPostsTable = pgTable("twitter_posts", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  headline: text("headline").notNull(),
  copied: boolean("copied").default(false).notNull(),
  posted: boolean("posted").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTwitterPostSchema = createInsertSchema(twitterPostsTable).omit({ id: true, createdAt: true });
export type InsertTwitterPost = z.infer<typeof insertTwitterPostSchema>;
export type TwitterPost = typeof twitterPostsTable.$inferSelect;

export const instagramCarouselsTable = pgTable("instagram_carousels", {
  id: serial("id").primaryKey(),
  headline: text("headline").notNull(),
  contentParagraph1: text("content_paragraph_1").notNull(),
  contentParagraph2: text("content_paragraph_2").notNull(),
  contentParagraph3: text("content_paragraph_3"),
  caption: text("caption"),
  coverImageData: text("cover_image_data"),
  slide1ImageData: text("slide1_image_data"),
  slide2ImageData: text("slide2_image_data"),
  slide3ImageData: text("slide3_image_data"),
  memeImageData: text("meme_image_data"),
  posted: boolean("posted").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInstagramCarouselSchema = createInsertSchema(instagramCarouselsTable).omit({ id: true, createdAt: true });
export type InsertInstagramCarousel = z.infer<typeof insertInstagramCarouselSchema>;
export type InstagramCarousel = typeof instagramCarouselsTable.$inferSelect;

export const twitterThreadsTable = pgTable("twitter_threads", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  tweets: text("tweets").notNull(),
  sourceArticles: text("source_articles"),
  hookImageUrl: text("hook_image_url"),
  posted: boolean("posted").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTwitterThreadSchema = createInsertSchema(twitterThreadsTable).omit({ id: true, createdAt: true });
export type InsertTwitterThread = z.infer<typeof insertTwitterThreadSchema>;
export type TwitterThread = typeof twitterThreadsTable.$inferSelect;

export const adGenTable = pgTable("ad_gen", {
  id: serial("id").primaryKey(),
  headline: text("headline").notNull(),
  subheadline: text("subheadline"),
  accentWord: text("accent_word"),
  style: text("style").notNull(),
  format: text("format").default("story").notNull(),
  imageData: text("image_data"),
  backgroundImageUrl: text("background_image_url"),
  bgColor: text("bg_color"),
  posted: boolean("posted").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAdGenSchema = createInsertSchema(adGenTable).omit({ id: true, createdAt: true });
export type InsertAdGen = z.infer<typeof insertAdGenSchema>;
export type AdGen = typeof adGenTable.$inferSelect;

export const instagramMarketSlideshowsTable = pgTable("instagram_market_slideshows", {
  id: serial("id").primaryKey(),
  marketIds: text("market_ids").notNull(),
  coverHeadline: text("cover_headline").notNull(),
  coverAccentWord: text("cover_accent_word"),
  coverImageData: text("cover_image_data"),
  slides: text("slides").notNull(),
  caption: text("caption"),
  posted: boolean("posted").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInstagramMarketSlideshowSchema = createInsertSchema(instagramMarketSlideshowsTable).omit({ id: true, createdAt: true });
export type InsertInstagramMarketSlideshow = z.infer<typeof insertInstagramMarketSlideshowSchema>;
export type InstagramMarketSlideshow = typeof instagramMarketSlideshowsTable.$inferSelect;

export const contentGenConversationsTable = pgTable("content_gen_conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  lang: text("lang").default("es").notNull(),
  posted: boolean("posted").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertContentGenConversationSchema = createInsertSchema(contentGenConversationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContentGenConversation = z.infer<typeof insertContentGenConversationSchema>;
export type ContentGenConversation = typeof contentGenConversationsTable.$inferSelect;

export const contentGenMessagesTable = pgTable("content_gen_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  attachments: text("attachments"),
  images: text("images"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertContentGenMessageSchema = createInsertSchema(contentGenMessagesTable).omit({ id: true, createdAt: true });
export type InsertContentGenMessage = z.infer<typeof insertContentGenMessageSchema>;
export type ContentGenMessage = typeof contentGenMessagesTable.$inferSelect;

export const usageTokensTable = pgTable("usage_tokens", {
  id: serial("id").primaryKey(),
  totalTokens: integer("total_tokens").default(0).notNull(),
  instagramTokens: integer("instagram_tokens").default(0).notNull(),
  adgenTokens: integer("adgen_tokens").default(0).notNull(),
  twitterTokens: integer("twitter_tokens").default(0).notNull(),
  contentgenTokens: integer("contentgen_tokens").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const usageDailyTable = pgTable("usage_daily", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  instagramTokens: integer("instagram_tokens").default(0).notNull(),
  adgenTokens: integer("adgen_tokens").default(0).notNull(),
  twitterTokens: integer("twitter_tokens").default(0).notNull(),
  contentgenTokens: integer("contentgen_tokens").default(0).notNull(),
});
