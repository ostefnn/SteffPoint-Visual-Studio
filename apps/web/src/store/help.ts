import { create } from 'zustand';

/** The help window, opened from the dashboard, the editor or the "?" key. */
export const useHelp = create<{ open: boolean }>(() => ({ open: false }));
export const openHelp = () => useHelp.setState({ open: true });
export const closeHelp = () => useHelp.setState({ open: false });
