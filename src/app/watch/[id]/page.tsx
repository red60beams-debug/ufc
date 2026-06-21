import { getUpcomingEvents } from "@/lib/ufc-data-fetcher";
import { ufcConfig } from "@/lib/ufc-config";
import { notFound } from "next/navigation";
import WatchClient from "./WatchClient";

export default async function WatchPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const events = await getUpcomingEvents(50);
  const event = events.find((e) => e.id === params.id) || null;

  if (!event && params.id !== 'config') {
    notFound();
  }

  const eventData = event || {
    id: 'config',
    name: ufcConfig.current_event.name,
    date: ufcConfig.current_event.date,
    venue: ufcConfig.current_event.venue,
    location: 'Las Vegas, Nevada',
    status: 'Upcoming',
    fighter1: ufcConfig.current_event.main_event.fighter1,
    fighter2: ufcConfig.current_event.main_event.fighter2,
    fighter1Img: ufcConfig.current_event.main_event.fighter1_img,
    fighter2Img: ufcConfig.current_event.main_event.fighter2_img,
    fighter1Record: ufcConfig.current_event.main_event.fighter1_record,
    fighter2Record: ufcConfig.current_event.main_event.fighter2_record,
    weightClass: ufcConfig.current_event.main_event.weight_class,
    fights: [],
  };

  return <WatchClient event={eventData} />;
}
