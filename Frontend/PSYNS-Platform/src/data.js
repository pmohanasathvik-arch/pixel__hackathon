export const initialStudents = [
  { rollNumber: "25AI001", name: "Ananya Rao", department: "AIML", year: "II", section: "A", conducted: 100, attended: 86, dataAsOf: "2026-10-10" },
  { rollNumber: "25AI002", name: "Rahul Varma", department: "AIML", year: "II", section: "A", conducted: 100, attended: 72, dataAsOf: "2026-10-10" },
  { rollNumber: "25AI003", name: "Meera Das", department: "CSE", year: "II", section: "B", conducted: 90, attended: 81, dataAsOf: "2026-10-10" },
  { rollNumber: "25AI004", name: "Arjun Kumar", department: "AIML", year: "II", section: "B", conducted: 100, attended: 75, dataAsOf: "2026-10-10" },
  { rollNumber: "25AI005", name: "Nisha Patel", department: "ECE", year: "II", section: "A", conducted: 100, attended: 68, dataAsOf: "2026-10-10" }
];
export const initialRequests = [
  { id: "EVT-1001", rollNumber: "25AI001", studentName: "Ananya Rao", eventName: "Google Cloud Study Jam", organizer: "Google Developer Groups", venue: "Vijayawada", startDate: "2026-10-22", category: "Workshop", url: "", status: "Pending Proctor Review", recommendation: "", proctorRemarks: "", finalRemarks: "", history: [{ at: "2026-10-11", action: "Request submitted" }] },
  { id: "EVT-1002", rollNumber: "25AI002", studentName: "Rahul Varma", eventName: "CodeSprint 2026", organizer: "Campus Tech Club", venue: "Online", startDate: "2026-10-25", category: "Competition", url: "", status: "Pending Final Decision", recommendation: "Recommend approval", proctorRemarks: "Event details reviewed.", finalRemarks: "", history: [{ at: "2026-10-10", action: "Request submitted" }, { at: "2026-10-11", action: "Proctor recommended approval" }] },
  { id: "EVT-1003", rollNumber: "25AI003", studentName: "Meera Das", eventName: "AI Innovation Meetup", organizer: "Tech Community", venue: "Guntur", startDate: "2026-11-02", category: "Conference", url: "", status: "Approved", recommendation: "Recommend approval", proctorRemarks: "Details verified.", finalRemarks: "Approved for participation.", history: [{ at: "2026-10-09", action: "Request submitted" }, { at: "2026-10-10", action: "Approved by in-charge" }] },
  { id: "EVT-1004", rollNumber: "25AI004", studentName: "Arjun Kumar", eventName: "Robotics Workshop", organizer: "Innovation Lab", venue: "Hyderabad", startDate: "2026-11-07", category: "Workshop", url: "", status: "Rejected", recommendation: "Recommend rejection", proctorRemarks: "Attendance requires review.", finalRemarks: "Please meet the event in-charge.", history: [{ at: "2026-10-08", action: "Request submitted" }, { at: "2026-10-09", action: "Rejected by in-charge" }] }
];
export const roles = [
  { value: "student", label: "Student", description: "Submit and track event requests" },
  { value: "proctor", label: "Proctor", description: "Review assigned student requests" },
  { value: "incharge", label: "Event In-charge", description: "Import attendance and make final decisions" }
];