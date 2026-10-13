function geoMessage(err) {
  switch (err && err.code) {
    case 1:
      return 'Location permission was denied. Allow location access for this site in your browser settings and try again.';
    case 2:
      return 'Your location could not be determined. Check that GPS or location services are on.';
    case 3:
      return 'Finding your location took too long. Please try again.';
    default:
      return 'Could not get your location.';
  }
}

function locationError(message) {
  const e = new Error(message);
  e.isLocation = true;
  return e;
}

export function getPosition() {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext) {
      reject(locationError('Location works only on localhost or an HTTPS address. Open the app on localhost, or after it is deployed with HTTPS.'));
      return;
    }
    if (!navigator.geolocation) {
      reject(locationError('Location is not supported on this device.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (err) => reject(locationError(geoMessage(err))),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  });
}