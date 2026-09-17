import { useEffect } from "react";

import { usePagedData } from "./usePagedData";
import { reflectionsService } from "@/services/reflections.service";
import { checkInsService } from "@/services/checkIns.service";
import { dataEvents } from "@/services/dataEvents";

const loadReflections = (options: Parameters<typeof reflectionsService.listReflections>[0]) => reflectionsService.listReflections(options);
const loadCheckIns = (options: Parameters<typeof checkInsService.listCheckIns>[0]) => checkInsService.listCheckIns(options);

export function useReflections() {
    const page = usePagedData(loadReflections);
    useEffect(() => dataEvents.subscribe("reflections", () => { void page.refresh(); }), [page.refresh]);
    return page;
}

export function useCheckIns() {
    const page = usePagedData(loadCheckIns);
    useEffect(() => dataEvents.subscribe("checkIns", () => { void page.refresh(); }), [page.refresh]);
    return page;
}
