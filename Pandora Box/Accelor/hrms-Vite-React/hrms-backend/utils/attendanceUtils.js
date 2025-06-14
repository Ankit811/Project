


function buildAttendanceData(attendanceRecords, attendanceView, fromDate, toDate) {
    // Convert string dates to Date objects
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const attendanceData = [];
  
    if (attendanceView === 'daily') {
      // For daily view, we'll show a range of days
      const totalDays = Math.floor((to - from) / (1000 * 60 * 60 * 24)) + 1;
      
      for (let i = 0; i < totalDays; i++) {
        const currentDate = new Date(from);
        currentDate.setDate(from.getDate() + i);
        
        // Skip Sundays
        if (currentDate.getDay() === 0) continue;
        
        const records = attendanceRecords.filter(
          a => {
            const logDate = new Date(a.logDate);
            return logDate.toDateString() === currentDate.toDateString();
          }
        );
        
        // Determine status based on attendance records
        const fullDay = records.some(a => a.status === 'Present');
        const halfDay = records.some(a => a.status === 'Half Day');
        const absent = records.length === 0;
  
        const status = fullDay ? 'present' : halfDay ? 'half' : absent ? 'absent' : 'leave';
        
        // Format date as DD MMM
        const formattedDate = currentDate.toLocaleString('default', { day: '2-digit', month: 'short' });
        attendanceData.push({ name: formattedDate, status });
      }
    } else if (attendanceView === 'monthly') {
      // Calculate days in month based on from date
      const daysInMonth = new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate();
      
      // Calculate the start and end days based on the date range
      const startDay = from.getDate();
      const endDay = Math.min(daysInMonth, to.getDate());
      
      for (let i = startDay; i <= endDay; i++) {
        const date = new Date(from.getFullYear(), from.getMonth(), i);
        
        // Skip Sundays
        if (date.getDay() === 0) continue;
        
        const records = attendanceRecords.filter(
          a => {
            const logDate = new Date(a.logDate);
            return logDate.toDateString() === date.toDateString();
          }
        );
  
        // Determine status based on attendance records
        const fullDay = records.some(a => a.status === 'Present');
        const halfDay = records.some(a => a.status === 'Half Day');
        const absent = records.length === 0;
  
        const status = fullDay ? 'present' : halfDay ? 'half' : absent ? 'absent' : 'leave';
        attendanceData.push({ name: `${i}`, status });
      }
    } else if (attendanceView === 'yearly') {
      // Get days from start date to end date
      const totalDays = Math.floor((to - from) / (1000 * 60 * 60 * 24)) + 1;
      
      for (let i = 0; i < totalDays; i++) {
        const date = new Date(from);
        date.setDate(from.getDate() + i);
        
        // Skip only Sundays
        if (date.getDay() === 0) continue;
        
        const records = attendanceRecords.filter(
          a => {
            const logDate = new Date(a.logDate);
            return logDate.toDateString() === date.toDateString();
          }
        );
  
        // Determine status based on attendance records
        const fullDay = records.some(a => a.status === 'Present');
        const halfDay = records.some(a => a.status === 'Half Day');
        const absent = records.length === 0;
  
        const status = fullDay ? 'present' : halfDay ? 'half' : absent ? 'absent' : 'leave';
        
        // Format date as DD MMM
        const formattedDate = date.toLocaleString('default', { day: '2-digit', month: 'short' });
        attendanceData.push({ name: formattedDate, status });
      }
    }
    return attendanceData;
  }

  export { buildAttendanceData };
