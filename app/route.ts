import {page} from "../lib/page";
export async function GET(){return new Response(page,{headers:{"Content-Type":"text/html; charset=utf-8"}})}
