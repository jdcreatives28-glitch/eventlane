// src/utils/loadPosts.js

import { supabase } from '../supabaseClient';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';           // ✅ Add this
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(utc);                            // ✅ Extend it
dayjs.extend(relativeTime);

function timeAgoShort(ts) {
  const t = new Date(ts).getTime();
  if (!t) return '';
  const diff = Date.now() - t;
  const m = 60_000, h = 60*m, d = 24*h;
  if (diff < m) return '1m';
  if (diff < h) return `${Math.floor(diff/m)}m`;
  if (diff < d) return `${Math.floor(diff/h)}h`;
  return `${Math.floor(diff/d)}d`;
}

export async function fetchPosts(setPosts, setLoading, currentUser = {}, letterColors = {}) {
  setLoading?.(true);
  try {
    // 1) posts
    const { data: posts, error } = await supabase
      .from('posts')
      .select('id,user_id,username,caption,photos,created_at,venue_id')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    if (!posts?.length) { setPosts?.([]); return; }

    // 2) profiles (only id, username)
    const userIds = Array.from(new Set(posts.map(p => p.user_id).filter(Boolean)));
    const { data: profiles } = userIds.length
      ? await supabase.from('profiles').select('id,username').in('id', userIds)
      : { data: [] };

    // 3) venues (for tag + Official Venue check)
    const venueIds = Array.from(new Set(posts.map(p => p.venue_id).filter(Boolean)));
    const { data: venues } = venueIds.length
      ? await supabase.from('theVenues').select('id,name,user_id').in('id', venueIds)
      : { data: [] };

    const profById = Object.fromEntries((profiles || []).map(p => [p.id, p]));
    const venueById = Object.fromEntries((venues || []).map(v => [v.id, v]));

    // 4) map/enrich
    const enriched = posts.map(p => {
      const profile = profById[p.user_id];
      const venue   = venueById[p.venue_id];

      const isVenuePoster =
        (p?.username && venue?.name) &&
        p.username.trim().toLowerCase() === (venue.name || '').trim().toLowerCase();

      // displayName: venue name when posting as venue, else profile.username, else stored p.username, else "User"
      const displayName = isVenuePoster
        ? (venue?.name || p.username || profile?.username || 'User')
        : (profile?.username || p.username || 'User');

      const initial = (displayName || 'U').slice(0,1).toUpperCase();

      return {
        ...p,
        theVenues: venue || null,
        isVenuePoster,
        displayName,
        initial,
        timeAgo: timeAgoShort(p.created_at),
      };
    });

    setPosts?.(enriched);
  } catch (e) {
    console.error('[fetchPosts] failed:', e);
    setPosts?.([]);
  } finally {
    setLoading?.(false);
  }
}