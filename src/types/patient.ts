export interface PatientInformation {
  FirstName: string;
  LastName: string;
  DateOfBirth: string;
  SSN: string;
  EmailID: string;
  MaritalStatus: string;
  PhoneNumber: string;
}

export interface Address {
  Type: string;
  AddressLine1: string;
  City: string;
  State: string;
  Country: string;
  ZipCode: string;
}

export interface FullPatientData {
  PatientInformation: PatientInformation;
  Address: Address;
}
