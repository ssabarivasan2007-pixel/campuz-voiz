const administrator = { name: 'Sabarivasan', email: 's.sabarivasan2007@gmail.com', role: 'Administrator' }

const facultyContacts = {
  '20237369': { name: 'Srishanth P', email: 's.sabarivasan2007@gmail.com', role: 'Faculty' },
  '20236379': { name: 'Saravana M', email: 's.sabarivasan2007@gmail.com', role: 'Faculty' },
}

const wifiCoordinator = { name: 'Sukanyaa', email: 'sv93428107@gmail.com', role: 'Wi-Fi Coordinator' }
const laboratoryCoordinator = { name: 'Sathvee', email: 's.sabarivasan2007@gmail.com', role: 'Laboratory Coordinator' }

export function resolveAlertRecipients(report) {
  const responsible = report.category === 'Faculty'
    ? facultyContacts[report.facultyId]
    : report.category === 'Infrastructure' && report.subcategory === 'WiFi'
      ? wifiCoordinator
      : report.category === 'Infrastructure' && report.subcategory === 'Laboratory'
        ? laboratoryCoordinator
        : null
  return responsible ? [responsible, administrator] : [administrator]
}