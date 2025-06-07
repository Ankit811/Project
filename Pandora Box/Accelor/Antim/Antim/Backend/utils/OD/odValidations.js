function validateODRequest(req, user) {
    if (!user.designation) {
      throw new Error('Employee designation is required');
    }
    if (!user.department) {
      throw new Error('Employee department is required');
    }
  
    const { dateOut, timeOut, dateIn, purpose, placeUnitVisit } = req.body;
  
    // Validate required fields
    if (!dateOut || !timeOut || !dateIn || !purpose || !placeUnitVisit) {
      throw new Error('All required fields (Date Out, Time Out, Date In, Purpose, Place/Unit Visit) must be provided');
    }
  
    // Validate date logic
    if (new Date(dateOut) > new Date(dateIn)) {
      throw new Error('Date Out must be before or equal to Date In');
    }
  
    return { dateOut, timeOut, dateIn, timeIn: req.body.timeIn, purpose, placeUnitVisit };
  }
  
  export { validateODRequest };