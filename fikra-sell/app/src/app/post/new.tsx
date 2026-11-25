import React from 'react';
import { AdForm } from '../../components/AdForm';
import { SessionGate } from '../../components/SessionGate';

export default function NewAd() {
  return <SessionGate><AdForm /></SessionGate>;
}
