import L from "leaflet";
import { useEffect, useRef } from "react";
import { Card, Loader, useLoad } from "../components";
import { rpc } from "../lib/api";
import { fmtDate, tr } from "../lib/i18n";

interface Loc { driver_id: string; full_name: string; phone: string; lat: number; lng: number; updated_at: string; order_code: string | null; order_status: string | null }

export default function LiveMap() {
  const data = useLoad(() => rpc<Loc[]>("admin_active_driver_locations"));
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current).setView([29.3375, 47.9744], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors", maxZoom: 19 }).addTo(map.current);
    return () => { map.current?.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    if (!map.current || !data.data) return;
    const layer = L.layerGroup().addTo(map.current);
    for (const d of data.data) {
      L.circleMarker([d.lat, d.lng], { radius: 9, color: "#fff", weight: 3, fillColor: "#1E46D8", fillOpacity: 1 })
        .bindPopup(`<b>${d.full_name.replace(/</g, "&lt;")}</b><br>${d.phone}<br>${d.order_code ?? ""} · ${d.order_status ?? ""}<br>${fmtDate(d.updated_at)}`)
        .addTo(layer);
    }
    return () => { layer.remove(); };
  }, [data.data]);
  return (
    <Card title={tr("مواقع المناديب أثناء الطلبات النشطة فقط", "Driver locations during active orders only")} actions={<button className="btn btn-ghost btn-sm" onClick={data.reload}>↻</button>}>
      <div className="alert">{tr("لا تُخزّن المواقع إلا أثناء الطلب النشط، وكل عرض لهذه الصفحة يُسجّل في سجل التدقيق.", "Locations exist only during active orders, and every view of this page is recorded in the audit log.")}</div>
      {data.error ? <Loader error={data.error} /> : null}
      <div ref={el} className="mapbox" />
      <p>{data.data ? `${data.data.length} ${tr("مندوب", "drivers")}` : ""}</p>
    </Card>
  );
}
