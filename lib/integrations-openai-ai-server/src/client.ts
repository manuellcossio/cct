import OpenAI from "openai";
import { getOpenAIClientOptions } from "./env";

export const openai = new OpenAI(getOpenAIClientOptions());
