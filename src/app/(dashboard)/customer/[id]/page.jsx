// Static Export එකට IDs Dummy විදිහට pass කරන්න
export async function generateStaticParams() {
  return [{ id: '1' }]
}
import CustomerProfile from '../../../../components/CustomerProfile'

export default async function CustomerPage({ params }) {
  const { id } = await params
  return <CustomerProfile customerId={id} />
}