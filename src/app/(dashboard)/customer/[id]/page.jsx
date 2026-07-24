import CustomerProfile from '../../../../components/CustomerProfile'

export default async function CustomerPage({ params }) {
  const { id } = await params
  return <CustomerProfile customerId={id} />
}